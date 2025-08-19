import { Request, Response } from 'express';
import mongoose, { Mongoose } from 'mongoose';
import { successHandler, errorHandler } from '../../utils/response-handler';
import VehicleType from '../../models/driver/vehicle_type.model';
import Trip, { ITrip } from '../../models/driver/trips.model';
import DriverLocation from '../../models/driver/driver_location.model';
import Notification from '../../models/driver/notification.model';
import { isValidMobile } from '../../utils/worker_function';
import User from '../../models/users.model';
import { sendTripNotification, sendPassengerTripNotification, sendRejectionTripNotification, sendTestNotification, sendMessageNotification, sendOverlayNotification } from '../../utils/notifications';
import Vehicle from '../../models/driver/vehicle.model';
import Credit from '../../models/credit_stack.model';

const MAX_DISTANCE_KM = 10;

function statusStack(status_type: any) {
    switch (status_type) {
        case 'searching': return 1;
        case 'scheduled': return 2;
        case 'loading': return 3;
        case 'in_transit': return 4;
        case 'unloading': return 5;
        case 'delivered': return 6;
        case 'cancelled': return 7;
        case 'failed_delivery': return 8;
        case 'delayed': return 9;
        case 'returned': return 10;
    }
    return 0
}

const tripController = {
    async createTrip(req: Request, res: Response): Promise<Response> {
        try {
            const {
                distance,
                from,
                to,
                material,
                material_unit,
                weight,
                eta_pickup,
                alternate_contact_no,
                assisstant = 0,
                status = 'searching',
                vehicle_type,
                from_latitude,
                from_longitude,
                payment,
                to_latitude,
                to_longitude
            } = req.body;

            // Validate required fields
            const missing = ["from", "to", "material", "material_unit", "weight", "from_latitude", "from_longitude", "vehicle_type"].filter(field => !req.body[field]);
            if (missing.length) {
                return res.status(400).send(errorHandler(`Missing fields: ${missing.join(', ')}`));
            }

            if (isNaN(from_latitude) || isNaN(from_longitude) || Math.abs(from_latitude) > 90 || Math.abs(from_longitude) > 180) {
                return res.status(400).send(errorHandler('Invalid pickup coordinates'));
            }

            if (to_latitude || to_longitude) {
                if (isNaN(to_latitude) || isNaN(to_longitude) || Math.abs(to_latitude) > 90 || Math.abs(to_longitude) > 180) {
                    return res.status(400).send(errorHandler('Invalid destination coordinates'));
                }
            }

            // Validate alternate contact number
            if (alternate_contact_no) {
                if (!isValidMobile(alternate_contact_no)) {
                    return res.status(400).send(errorHandler('Contact number is invalid, Enter valid contact number.'));
                }
            }

            // Validate assistants count
            if (assisstant && (assisstant < 0 || assisstant > 5)) {
                return res.status(400).send(errorHandler('Assistant count must be between 0 and 5'));
            }

            // Validate material and vehicle IDs
            if (!mongoose.Types.ObjectId.isValid(material)) {
                return res.status(400).send(errorHandler('Invalid Material ID'));
            }

            if (vehicle_type) {
                if (!mongoose.Types.ObjectId.isValid(vehicle_type)) {
                    return res.status(400).send(errorHandler('Invalid vehicle type ID'));
                }
            }

            let trip_cost_customer = 0;
            let trip_cost_driver = 0;
            let fare_used = {
                customer_base_fare: 0,
                customer_km_fare: 0,
                driver_base_fare: 0,
                driver_km_fare: 0,
            };

            const vehicle_type_details = await VehicleType.findById(vehicle_type);
            if (!vehicle_type_details) {
                return res.status(400).send(errorHandler('Invalid vehicle type ID'));
            } else {
                trip_cost_customer = (parseInt(distance) * vehicle_type_details.customer_km_fare) + vehicle_type_details.customer_base_fare;
                trip_cost_driver = (parseInt(distance) * vehicle_type_details.driver_km_fare) + vehicle_type_details.driver_base_fare;
                fare_used.customer_base_fare = vehicle_type_details.customer_base_fare;
                fare_used.customer_km_fare = vehicle_type_details.customer_km_fare;
                fare_used.driver_base_fare = vehicle_type_details.driver_base_fare;
                fare_used.driver_km_fare = vehicle_type_details.driver_km_fare;
            }

            // Validate status
            const validStatuses = ["scheduled", "searching", "loading", "in_transit", "unloading", "delivered", "cancelled", "failed_delivery", "delayed", "returned"];
            if (status && !validStatuses.includes(status)) {
                return res.status(400).send(errorHandler('Invalid trip status'));
            }

            const user = req.body.user;
            if (!user) {
                return res.status(400).send(errorHandler('User information is required'));
            }

            const newTrip = new Trip({
                user,
                distance,
                // trip_cost,
                trip_cost_customer,
                trip_cost_driver,
                fare_used,
                from,
                to,
                material,
                material_unit,
                weight,
                eta_pickup: eta_pickup ? new Date(eta_pickup) : undefined,
                alternate_contact_no: alternate_contact_no || "",
                assisstant,
                status,
                payment,
                vehicle_type,
                from_latitude,
                from_longitude,
                to_latitude,
                to_longitude
            });

            const vehicle_users = await Vehicle.find({ vehicle_type: vehicle_type }).select('user');
            const vehicle_users_modified = vehicle_users.map((ele) => ele.user != null && ele.user.toString());
            const unique_vehicle_users = [...new Set(vehicle_users_modified)];

            const trip = await newTrip.save();

            // Find nearby drivers within 10KM using geospatial query
            // const driverLocations = await DriverLocation.find({
            //     location: {
            //         $nearSphere: {
            //             $geometry: {
            //                 type: "Point",
            //                 coordinates: [parseFloat(from_longitude as string), parseFloat(from_latitude as string)]
            //             },
            //             $maxDistance: MAX_DISTANCE_KM * 1000 // Convert km to meters
            //         }
            //     }
            // })
            //     .populate({
            //         path: 'user',
            //         match: {
            //             status: 'active',
            //             availability: 'online',
            //             type: 'driver'
            //         },
            //         select: 'fullname email contact_no vehicle_details'
            //     })
            //     .lean(); previous code

            const driverLocations = await DriverLocation.find()
                .populate({
                    path: 'user',
                    match: {
                        status: 'active',
                        // availability: 'online',
                        type: 'driver'
                    },
                    select: 'fullname email contact_no vehicle_details'
                })
                .lean();

            const runningStatuses = ['loading', 'in_transit', 'unloading'];

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const runningTrips = await Trip.find({
                status: { $in: runningStatuses },
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                driver_responses: {
                    $elemMatch: {
                        response: 'accepted'
                    }
                }
            }).select('driver_responses');

            const busyDriverIds = new Set();
            for (const trip of runningTrips) {
                for (const dr of trip.driver_responses) {
                    if (dr.response === 'accepted') {
                        busyDriverIds.add(dr.driver.toString());
                    }
                }
            }

            // const availableDrivers = driverLocations.filter(dl =>
            //    dl.user !== null && !busyDriverIds.has(dl.user?._id.toString()) && unique_vehicle_users.includes(dl.user?._id.toString())
            // ); previous code  commented for checking. (main condition)
            // const availableDrivers = driverLocations.filter(dl => dl.user !== null && unique_vehicle_users.includes(dl.user?._id.toString()));

            // if (availableDrivers.length === 0) {
            //     await Trip.findByIdAndUpdate(trip._id, { status: 'scheduled' });
            //     return res.status(200).send(successHandler('No available drivers nearby', {
            //         trip: trip,
            //         available_drivers: 0
            //     }));
            // } previous code
            const all_drivers = await User.find({ type: "driver" }).lean(); // for testing
            const availableDrivers = all_drivers.filter(dl => unique_vehicle_users.includes(dl._id.toString())); // for testing

            // const uniqueDriversMap = new Map();
            // availableDrivers.forEach(driver => {
            //     const userId = driver.user._id.toString();
            //     if (!uniqueDriversMap.has(userId)) {
            //         uniqueDriversMap.set(userId, driver);
            //     }
            // });

            // const uniqueAvailableDrivers = [...uniqueDriversMap.values()];

            const uniqueAvailableDrivers = availableDrivers; // for testing

            const driverResponses = uniqueAvailableDrivers.map(driver => ({
                // driver: driver.user._id,
                driver: driver._id, // for testing
                response: 'pending',
                responded_at: null
            }));

            // Update trip with potential drivers
            await Trip.findByIdAndUpdate(trip._id, {
                $set: { potential_drivers: uniqueAvailableDrivers.map(d => d._id) }, // d.user._id
                $push: { driver_responses: { $each: driverResponses } }
            });

            // Send notifications to available drivers
            const notificationPromises = uniqueAvailableDrivers.map(async (driverLocation) => {
                const notification = new Notification({
                    user: driverLocation._id,  // driverLocation.user._id
                    title: 'New Trip Request',
                    message: `New trip available from ${from} to ${to}`,
                    type: 'trip_request',
                    related_id: trip._id,
                    notify_to: "driver", // driver , customer
                    metadata: {
                        trip_id: trip._id,
                        from_location: {
                            path: trip.from || from,
                            coordinates: [from_longitude, from_latitude]
                        },
                        to_location: to_longitude && to_latitude ?
                            {
                                path: trip.to || to,
                                coordinates: [to_longitude, to_latitude]
                            } : null,
                        distance: trip.distance,
                        fare: {
                            customer: trip.trip_cost_customer,
                            driver: trip.trip_cost_driver
                        },
                        weight: trip.weight,
                        material_unit: trip.material_unit
                    }
                });

                const driver = await User.findById(driverLocation._id).select('fcm_token'); // driverLocation.user._id

                if (driver?.fcm_token) {
                    await sendTripNotification(driver.fcm_token, {
                        _id: trip._id as mongoose.Types.ObjectId,
                        trip_cost_customer: trip.trip_cost_customer ? trip.trip_cost_customer : 0,
                        trip_cost_driver: trip.trip_cost_driver ? trip.trip_cost_driver : 0,
                        type: "driver",
                        from: trip.from ? trip.from : "",
                        to: trip.to ? trip.to : "",
                        eta_pickup: String(trip.eta_pickup) || ""
                    });
                }
                return notification.save();
            });

            await Promise.all(notificationPromises);
            return res.status(201).send(successHandler('Trip created successfully', trip, {
                available_drivers: uniqueAvailableDrivers.length,
                notified_drivers: uniqueAvailableDrivers.map(d => d._id) // d.user._id
            }));

        } catch (error: any) {
            console.error('Error creating trip:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async createTripByAdmin(req: Request, res: Response): Promise<Response> {
        try {
            const {
                distance,
                // trip_cost,
                from,
                to,
                material,
                material_unit,
                weight,
                material_width,
                material_height,
                eta_pickup,
                // base_fare,
                driver,
                customer_base_fare,
                driver_base_fare,
                alternate_contact_no,
                assisstant = 0,
                status = 'searching',
                vehicle_type,
                from_latitude,
                from_longitude,
                payment,
                to_latitude,
                to_longitude
            } = req.body;

            // Validate required fields
            const missing = ["from", "to", "material", "material_unit", "weight", "from_latitude", "from_longitude", "vehicle_type"].filter(field => !req.body[field]);
            if (missing.length) {
                return res.status(400).send(errorHandler(`Missing fields: ${missing.join(', ')}`));
            }

            if (isNaN(from_latitude) || isNaN(from_longitude) || Math.abs(from_latitude) > 90 || Math.abs(from_longitude) > 180) {
                return res.status(400).send(errorHandler('Invalid pickup coordinates'));
            }

            if (to_latitude || to_longitude) {
                if (isNaN(to_latitude) || isNaN(to_longitude) || Math.abs(to_latitude) > 90 || Math.abs(to_longitude) > 180) {
                    return res.status(400).send(errorHandler('Invalid destination coordinates'));
                }
            }

            // Validate alternate contact number
            if (alternate_contact_no) {
                if (!isValidMobile(alternate_contact_no)) {
                    return res.status(400).send(errorHandler('Contact number is invalid, Enter valid contact number.'));
                }
            }

            // Validate assistants count
            if (assisstant && (assisstant < 0 || assisstant > 5)) {
                return res.status(400).send(errorHandler('Assistant count must be between 0 and 5'));
            }

            // Validate material and vehicle IDs
            if (!mongoose.Types.ObjectId.isValid(material)) {
                return res.status(400).send(errorHandler('Invalid Material ID'));
            }

            if (vehicle_type) {
                if (!mongoose.Types.ObjectId.isValid(vehicle_type)) {
                    return res.status(400).send(errorHandler('Invalid vehicle type ID'));
                }
            }

            let trip_cost_customer = 0;
            let trip_cost_driver = 0;
            let fare_used = {
                customer_base_fare: 0,
                customer_km_fare: 0,
                driver_base_fare: 0,
                driver_km_fare: 0,
            };

            const vehicle_type_details = await VehicleType.findById(vehicle_type);
            if (!vehicle_type_details) {
                return res.status(400).send(errorHandler('Invalid vehicle type ID'));
            } else {
                trip_cost_customer = (parseInt(distance) * vehicle_type_details.customer_km_fare) + (customer_base_fare ? parseFloat(customer_base_fare) : vehicle_type_details.customer_base_fare);

                trip_cost_driver = (parseInt(distance) * vehicle_type_details.driver_km_fare) + (driver_base_fare ? parseFloat(driver_base_fare) : vehicle_type_details.driver_base_fare);

                fare_used.customer_base_fare = customer_base_fare ? parseFloat(customer_base_fare) : vehicle_type_details.customer_base_fare;
                fare_used.customer_km_fare = vehicle_type_details.customer_km_fare;
                fare_used.driver_base_fare = driver_base_fare ? parseFloat(driver_base_fare) : vehicle_type_details.driver_base_fare;
                fare_used.driver_km_fare = vehicle_type_details.driver_km_fare;
            }

            // Validate status
            const validStatuses = ["scheduled", "searching", "loading", "in_transit", "unloading", "delivered", "cancelled", "failed_delivery", "delayed", "returned"];
            if (status && !validStatuses.includes(status)) {
                return res.status(400).send(errorHandler('Invalid trip status'));
            }

            // Set user based on requester role
            const user = req.body.user;
            if (!user) {
                return res.status(400).send(errorHandler('User information is required'));
            }

            const newTrip = new Trip({
                user,
                distance,
                // trip_cost,
                trip_cost_customer,
                trip_cost_driver,
                fare_used,
                from,
                to,
                material,
                material_unit,
                weight,
                eta_pickup: eta_pickup ? new Date(eta_pickup) : undefined,
                alternate_contact_no: alternate_contact_no || "",
                assisstant,
                material_width: parseInt(material_width),
                material_height: parseInt(material_height),
                status,
                payment,
                from_latitude,
                from_longitude,
                to_latitude,
                to_longitude
            });

            const trip = await newTrip.save();

            if (driver) {
                const vehicle_detail = await Vehicle.findOne({ user: driver, vehicle_type: trip.vehicle_type });
                if (vehicle_detail) {
                    await Trip.updateOne(
                        {
                            _id: trip._id,
                            'driver_responses.driver': new mongoose.Types.ObjectId(driver)
                        },
                        {
                            $set: {
                                'driver_responses.$.response': "accepted",
                                'driver_responses.$.responded_at': new Date(),
                                vehicle_details: vehicle_detail._id
                            }
                        }
                    );
                    await Trip.findByIdAndUpdate(
                        trip._id,
                        {
                            driver: driver,
                            status: 'scheduled',
                            assigned_at: new Date()
                        },
                        { new: true }
                    );

                    await Trip.findByIdAndUpdate(
                        trip._id,
                        {
                            $push: {
                                status_stack: {
                                    stack_id: statusStack("scheduled"),
                                    status: "scheduled",
                                    createdAt: new Date()
                                }
                            }
                        },
                        { new: true }
                    );
                }
                const passengerNotification = new Notification({
                    user: trip.user,
                    title: 'Driver Assigned',
                    message: `Driver has assigned to your trip`,
                    type: 'trip_update',
                    related_id: trip._id,
                    notify_to: "customer", // driver , customer
                    metadata: {
                        trip_id: trip._id,
                        from_location: {
                            path: trip.from,
                            coordinates: [trip.from_longitude, trip.from_latitude]
                        },
                        to_location:
                        {
                            path: trip.to,
                            coordinates: [trip.to_longitude, trip.to_latitude]
                        },
                        distance: trip.distance,
                        fare: {
                            customer: trip.trip_cost_customer,
                            driver: trip.trip_cost_driver
                        },
                        weight: trip.weight,
                        material_unit: trip.material_unit
                    }
                });

                const passengerData = await User.findById(trip.user);
                if (passengerData?.fcm_token) {
                    await sendPassengerTripNotification(passengerData.fcm_token, {
                        _id: trip._id as mongoose.Types.ObjectId,
                        type: "customer",
                        response: 'accepted',
                    });
                }
                await passengerNotification.save();

                const notification = new Notification({
                    user: new mongoose.Types.ObjectId(driver),  // driverLocation.user._id
                    title: 'New Trip Request',
                    message: `New trip available from ${from} to ${to}`,
                    type: 'trip_request',
                    user_response: "accepted",
                    related_id: trip._id,
                    notify_to: "driver", // driver , customer
                    metadata: {
                        trip_id: trip._id,
                        from_location: {
                            path: trip.from || from,
                            coordinates: [from_longitude, from_latitude]
                        },
                        to_location: to_longitude && to_latitude ?
                            {
                                path: trip.to || to,
                                coordinates: [to_longitude, to_latitude]
                            } : null,
                        distance: trip.distance,
                        fare: {
                            customer: trip.trip_cost_customer,
                            driver: trip.trip_cost_driver
                        },
                        weight: trip.weight,
                        material_unit: trip.material_unit
                    }
                });

                const driverr = await User.findById(new mongoose.Types.ObjectId(driver)).select('fcm_token'); // driverLocation.user._id

                if (driverr?.fcm_token) {
                    await sendTripNotification(driverr.fcm_token, {
                        _id: trip._id as mongoose.Types.ObjectId,
                        trip_cost_customer: trip.trip_cost_customer ? trip.trip_cost_customer : 0,
                        trip_cost_driver: trip.trip_cost_driver ? trip.trip_cost_driver : 0,
                        type: "driver",
                        from: trip.from ? trip.from : "",
                        to: trip.to ? trip.to : "",
                        eta_pickup: String(trip.eta_pickup) || ""
                    });
                }
                notification.save();

                return res.status(201).send(successHandler('Trip created successfully', trip, {
                    available_drivers: 1,
                    notified_drivers: [driver]
                }));
            } else {
                const vehicle_users = await Vehicle.find({ vehicle_type: vehicle_type }).select('user');
                const vehicle_users_modified = vehicle_users.map((ele) => ele.user != null && ele.user.toString());
                const unique_vehicle_users = [...new Set(vehicle_users_modified)];

                // Find nearby drivers within 10KM using geospatial query
                // const driverLocations = await DriverLocation.find({
                //     location: {
                //         $nearSphere: {
                //             $geometry: {
                //                 type: "Point",
                //                 coordinates: [parseFloat(from_longitude as string), parseFloat(from_latitude as string)]
                //             },
                //             $maxDistance: MAX_DISTANCE_KM * 1000 // Convert km to meters
                //         }
                //     }
                // })
                //     .populate({
                //         path: 'user',
                //         match: {
                //             status: 'active',
                //             availability: 'online',
                //             type: 'driver'
                //         },
                //         select: 'fullname email contact_no vehicle_details'
                //     })
                //     .lean(); previous code

                const driverLocations = await DriverLocation.find()
                    .populate({
                        path: 'user',
                        match: {
                            status: 'active',
                            // availability: 'online',
                            type: 'driver'
                        },
                        select: 'fullname email contact_no vehicle_details'
                    })
                    .lean();

                const runningStatuses = ['loading', 'in_transit', 'unloading'];

                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);

                const runningTrips = await Trip.find({
                    status: { $in: runningStatuses },
                    createdAt: { $gte: startOfDay, $lte: endOfDay },
                    driver_responses: {
                        $elemMatch: {
                            response: 'accepted'
                        }
                    }
                }).select('driver_responses');

                const busyDriverIds = new Set();
                for (const trip of runningTrips) {
                    for (const dr of trip.driver_responses) {
                        if (dr.response === 'accepted') {
                            busyDriverIds.add(dr.driver.toString());
                        }
                    }
                }

                // const availableDrivers = driverLocations.filter(dl =>
                //     dl.user !== null && !busyDriverIds.has(dl.user?._id.toString()) && unique_vehicle_users.includes(dl.user?._id.toString())
                // ); previous code commented for checking. (main condition)
                // const availableDrivers = driverLocations.filter(dl => dl.user !== null && unique_vehicle_users.includes(dl.user?._id.toString()));
                // console.log('availableDrivers', availableDrivers);
                // if (availableDrivers.length === 0) {
                //     await Trip.findByIdAndUpdate(trip._id, { status: 'scheduled' });
                //     return res.status(200).send(successHandler('No available drivers nearby', {
                //         trip: trip,
                //         available_drivers: 0
                //     }));
                // } previous code

                const all_drivers = await User.find({ type: "driver" }).lean(); // for testing
                const availableDrivers = all_drivers.filter(dl => unique_vehicle_users.includes(dl._id.toString())); // for testing


                // const uniqueDriversMap = new Map();
                // availableDrivers.forEach(driver => {
                //     const userId = driver.user._id.toString();
                //     if (!uniqueDriversMap.has(userId)) {
                //         uniqueDriversMap.set(userId, driver);
                //     }
                // });

                // const uniqueAvailableDrivers = [...uniqueDriversMap.values()];

                const uniqueAvailableDrivers = availableDrivers; // for testing

                const driverResponses = uniqueAvailableDrivers.map(driver => ({
                    // driver: driver.user._id,
                    driver: driver._id, // for testing
                    response: 'pending',
                    responded_at: null
                }));

                // // Update trip with potential drivers
                await Trip.findByIdAndUpdate(trip._id, {
                    $set: { potential_drivers: uniqueAvailableDrivers.map(d => d._id) }, // d.user._id
                    $push: { driver_responses: { $each: driverResponses } }
                });

                // // Send notifications to available drivers
                const notificationPromises = uniqueAvailableDrivers.map(async (driverLocation) => {
                    const notification = new Notification({
                        user: driverLocation._id,  // driverLocation.user._id
                        title: 'New Trip Request',
                        message: `New trip available from ${from} to ${to}`,
                        type: 'trip_request',
                        related_id: trip._id,
                        notify_to: "driver", // driver , customer
                        metadata: {
                            trip_id: trip._id,
                            from_location: {
                                path: trip.from || from,
                                coordinates: [from_longitude, from_latitude]
                            },
                            to_location: to_longitude && to_latitude ?
                                {
                                    path: trip.to || to,
                                    coordinates: [to_longitude, to_latitude]
                                } : null,
                            distance: trip.distance,
                            fare: {
                                customer: trip.trip_cost_customer,
                                driver: trip.trip_cost_driver
                            },
                            weight: trip.weight,
                            material_unit: trip.material_unit
                        }
                    });

                    const driver = await User.findById(driverLocation._id).select('fcm_token'); // driverLocation.user._id

                    if (driver?.fcm_token) {
                        await sendTripNotification(driver.fcm_token, {
                            _id: trip._id as mongoose.Types.ObjectId,
                            trip_cost_customer: trip.trip_cost_customer ? trip.trip_cost_customer : 0,
                            trip_cost_driver: trip.trip_cost_driver ? trip.trip_cost_driver : 0,
                            from: trip.from ? trip.from : "",
                            type: "driver",
                            to: trip.to ? trip.to : "",
                            eta_pickup: String(trip.eta_pickup) || ""
                        });
                    }
                    return notification.save();
                });

                await Promise.all(notificationPromises);
                return res.status(201).send(successHandler('Trip created successfully', trip, {
                    available_drivers: uniqueAvailableDrivers.length,
                    notified_drivers: uniqueAvailableDrivers.map(d => d._id) // d.user._id
                }));
            }
        } catch (error: any) {
            console.error('Error creating trip:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async manuallyAssignedDriver(req: Request, res: Response): Promise<Response> {
        try {
            const { trip_id, driver_id } = req.body;

            if (!trip_id || !driver_id) {
                return res.status(400).send(errorHandler('Required parameter is missing.'))
            }

            const trip = await Trip.findOne({
                _id: new mongoose.Types.ObjectId(trip_id),
                status: 'searching'
            });

            if (!trip) {
                return res.status(404).send(errorHandler('Trip not found or already assigned'));
            }

            let eta_date = null;
            if (trip.eta_pickup) {
                const now = new Date();
                const etaDate = new Date(trip.eta_pickup);

                const isFutureDate = etaDate > now;
                if (isFutureDate) {
                    const startOfDay = new Date(etaDate);
                    startOfDay.setHours(0, 0, 0, 0);

                    const endOfDay = new Date(etaDate);
                    endOfDay.setHours(23, 59, 59, 999);

                    const existingTrip = await Trip.findOne({
                        'driver_responses': {
                            $elemMatch: {
                                driver: new mongoose.Types.ObjectId(driver_id),
                                response: 'accepted',
                            }
                        },
                        eta_pickup: {
                            $gte: startOfDay,
                            $lte: endOfDay
                        }
                    });

                    if (existingTrip) {
                        const driver_data = await User.findById(driver_id);
                        if (driver_data?.fcm_token) {
                            await sendMessageNotification(driver_data.fcm_token,
                                'Alert',
                                'You have already accepted a trip on this date.'
                            );
                        }
                        return res.status(400).send(errorHandler('You have already accepted a trip on this date.'));
                    } else {
                        eta_date = isFutureDate;
                    }
                }
            } else {
                const now = new Date();
                const after_one_hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);
                eta_date = after_one_hour;
            }

            const vehicle_detail = await Vehicle.findOne({ user: driver_id, vehicle_type: trip.vehicle_type });
            if (vehicle_detail) {
                await Trip.updateOne(
                    {
                        _id: new mongoose.Types.ObjectId(trip_id),
                        'driver_responses.driver': new mongoose.Types.ObjectId(driver_id)
                    },
                    {
                        $set: {
                            'driver_responses.$.response': "accepted",
                            'driver_responses.$.responded_at': new Date(),
                            vehicle_details: vehicle_detail._id,
                            eta_pickup: eta_date
                        }
                    }
                );
            } else {
                // Update driver's response
                await Trip.updateOne(
                    {
                        _id: new mongoose.Types.ObjectId(trip_id),
                        'driver_responses.driver': new mongoose.Types.ObjectId(driver_id)
                    },
                    {
                        $set: {
                            'driver_responses.$.response': "accepted",
                            'driver_responses.$.responded_at': new Date(),
                            eta_pickup: eta_date
                        }
                    }
                );
            }

            await Trip.findByIdAndUpdate(
                trip_id,
                {
                    driver: driver_id,
                    status: 'scheduled',
                    assigned_at: new Date()
                },
                { new: true }
            );

            await Trip.findByIdAndUpdate(
                trip_id,
                {
                    $push: {
                        status_stack: {
                            stack_id: statusStack("scheduled"),
                            status: "scheduled",
                            createdAt: new Date()
                        }
                    }
                },
                { new: true }
            );

            const passengerNotification = new Notification({
                user: trip.user,
                title: 'Driver Assigned',
                message: `Admin has assigned driver`,
                type: 'trip_update',
                related_id: trip_id,
                notify_to: "customer", // driver , customer
                metadata: {
                    trip_id: trip._id,
                    from_location: {
                        path: trip.from,
                        coordinates: [trip.from_longitude, trip.from_latitude]
                    },
                    to_location:
                    {
                        path: trip.to,
                        coordinates: [trip.to_longitude, trip.to_latitude]
                    },
                    distance: trip.distance,
                    fare: {
                        customer: trip.trip_cost_customer,
                        driver: trip.trip_cost_driver
                    },
                    weight: trip.weight,
                    material_unit: trip.material_unit
                }
            });

            const passengerData = await User.findById(trip.user);
            if (passengerData?.fcm_token) {
                await sendPassengerTripNotification(passengerData.fcm_token, {
                    _id: trip._id as mongoose.Types.ObjectId,
                    type: "customer",
                    response: 'accepted',
                });
            }
            await passengerNotification.save();

            const notification = new Notification({
                user: new mongoose.Types.ObjectId(driver_id),  // driverLocation.user._id
                title: 'New Trip Request',
                message: `New trip available from ${trip.from} to ${trip.to}`,
                type: 'trip_request',
                user_response: "accepted",
                related_id: trip._id,
                notify_to: "driver", // driver , customer
                metadata: {
                    trip_id: trip._id,
                    from_location: {
                        path: trip.from,
                        coordinates: [trip.from_longitude, trip.from_latitude]
                    },
                    to_location:
                    {
                        path: trip.to,
                        coordinates: [trip.to_longitude, trip.to_latitude]
                    },
                    distance: trip.distance,
                    fare: {
                        customer: trip.trip_cost_customer,
                        driver: trip.trip_cost_driver
                    },
                    weight: trip.weight,
                    material_unit: trip.material_unit
                }
            });

            const driverr = await User.findById(new mongoose.Types.ObjectId(driver_id)).select('fcm_token'); // driverLocation.user._id

            if (driverr?.fcm_token) {
                await sendTripNotification(driverr.fcm_token, {
                    _id: trip._id as mongoose.Types.ObjectId,
                    trip_cost_customer: trip.trip_cost_customer ? trip.trip_cost_customer : 0,
                    trip_cost_driver: trip.trip_cost_driver ? trip.trip_cost_driver : 0,
                    type: "driver",
                    from: trip.from ? trip.from : "",
                    to: trip.to ? trip.to : "",
                    eta_pickup: String(trip.eta_pickup) || ""
                });
            }
            notification.save();

            return res.status(200).send(successHandler('Manually driver assigend sucessfully.'));
        } catch (error: any) {
            console.error('Error responding to trip:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async respondToTripRequest(req: Request, res: Response): Promise<Response> {
        try {
            const { trip_id, response } = req.body;
            const driver_id = req.user?.id;

            if (!trip_id || !response || !['accept', 'reject'].includes(response)) {
                return res.status(400).send(errorHandler('Invalid request parameters'));
            }

            if (!mongoose.Types.ObjectId.isValid(trip_id)) {
                return res.status(400).send(errorHandler('Invalid Trip ID'));
            }

            const trip = await Trip.findOne({
                _id: new mongoose.Types.ObjectId(trip_id),
                status: 'searching',
                driver_responses: {
                    $elemMatch: {
                        driver: new mongoose.Types.ObjectId(driver_id)
                    }
                }
            });

            if (!trip) {
                return res.status(404).send(errorHandler('Trip not found or already assigned'));
            }

            if (response === 'accept' && trip.eta_pickup) {
                const now = new Date();
                const etaDate = new Date(trip.eta_pickup);

                const isFutureDate = etaDate > now;
                if (isFutureDate) {
                    const startOfDay = new Date(etaDate);
                    startOfDay.setHours(0, 0, 0, 0);

                    const endOfDay = new Date(etaDate);
                    endOfDay.setHours(23, 59, 59, 999);

                    const existingTrip = await Trip.findOne({
                        'driver_responses': {
                            $elemMatch: {
                                driver: new mongoose.Types.ObjectId(driver_id),
                                response: 'accepted',
                            }
                        },
                        eta_pickup: {
                            $gte: startOfDay,
                            $lte: endOfDay
                        }
                    });

                    if (existingTrip) {
                        const driver_data = await User.findById(driver_id);
                        if (driver_data?.fcm_token) {
                            await sendMessageNotification(driver_data.fcm_token,
                                'Alert',
                                'You have already accepted a trip on this date.'
                            );
                        }
                        return res.status(400).send(errorHandler('You have already accepted a trip on this date.'));
                    }
                }
            }

            const vehicle_detail = await Vehicle.findOne({ user: driver_id, vehicle_type: trip.vehicle_type });
            if (vehicle_detail) {
                // Update driver's response
                await Trip.updateOne(
                    {
                        _id: new mongoose.Types.ObjectId(trip_id),
                        'driver_responses.driver': new mongoose.Types.ObjectId(driver_id)
                    },
                    {
                        $set: {
                            'driver_responses.$.response': response === 'accept' ? 'accepted' : 'rejected',
                            'driver_responses.$.responded_at': new Date(),
                            vehicle_details: vehicle_detail._id
                        }
                    }
                );
            } else {
                // Update driver's response
                await Trip.updateOne(
                    {
                        _id: new mongoose.Types.ObjectId(trip_id),
                        'driver_responses.driver': new mongoose.Types.ObjectId(driver_id)
                    },
                    {
                        $set: {
                            'driver_responses.$.response': response === 'accept' ? 'accepted' : 'rejected',
                            'driver_responses.$.responded_at': new Date()
                        }
                    }
                );
            }

            if (response === "reject") {
                const no_ = await Notification.findOneAndUpdate({
                    "metadata.trip_id": new mongoose.Types.ObjectId(trip_id),
                    user: new mongoose.Types.ObjectId(driver_id),
                    notify_to: "driver"
                },
                    {
                        user_response: "rejected"
                    },
                    { new: true }
                )
            }

            if (response === 'accept') {
                // Update trip with driver and change status
                const updatedTrip = await Trip.findByIdAndUpdate(
                    trip_id,
                    {
                        driver: driver_id,
                        status: 'scheduled',
                        assigned_at: new Date()
                    },
                    { new: true }
                );

                await Trip.findByIdAndUpdate(
                    trip_id,
                    {
                        $push: {
                            status_stack: {
                                stack_id: statusStack("scheduled"),
                                status: 'scheduled',
                                createdAt: new Date()
                            }
                        }
                    },
                    { new: true }
                );

                await Notification.findOneAndUpdate({
                    "metadata.trip_id": new mongoose.Types.ObjectId(trip_id),
                    user: new mongoose.Types.ObjectId(driver_id),
                    notify_to: "driver"
                },
                    {
                        user_response: "accepted"
                    },
                    { new: true }
                )

                // Notify the passenger
                const passengerNotification = new Notification({
                    user: trip.user,
                    title: 'Driver Assigned',
                    message: `Driver has accepted your trip request`,
                    type: 'trip_update',
                    related_id: trip_id,
                    notify_to: "customer", // driver , customer
                    metadata: {
                        trip_id: trip._id,
                        from_location: {
                            path: trip.from,
                            coordinates: [trip.from_longitude, trip.from_latitude]
                        },
                        to_location:
                        {
                            path: trip.to,
                            coordinates: [trip.to_longitude, trip.to_latitude]
                        },
                        distance: trip.distance,
                        fare: {
                            customer: trip.trip_cost_customer,
                            driver: trip.trip_cost_driver
                        },
                        weight: trip.weight,
                        material_unit: trip.material_unit
                    }
                });

                const passengerData = await User.findById(trip.user);
                if (passengerData?.fcm_token) {
                    await sendPassengerTripNotification(passengerData.fcm_token, {
                        _id: trip._id as mongoose.Types.ObjectId,
                        type: "customer",
                        response: 'accepted',
                    });
                }
                await passengerNotification.save();

                // Notify other drivers
                const otherDrivers = trip.driver_responses
                    .filter((dr: any) => dr.driver.toString() !== driver_id.toString())
                    .map((dr: any) => dr.driver);

                if (otherDrivers.length > 0) {
                    const rejectionNotifications = otherDrivers.map(async (driverId: mongoose.Types.ObjectId) => {
                        const notification = new Notification({
                            user: driverId,
                            title: 'Trip Assigned',
                            message: `Trip ${trip_id} has been assigned to another driver`,
                            type: 'trip_update',
                            related_id: trip_id,
                            notify_to: "driver", // driver , customer
                            metadata: {
                                trip_id: trip._id,
                                from_location: {
                                    path: trip.from,
                                    coordinates: [trip.from_longitude, trip.from_latitude]
                                },
                                to_location:
                                {
                                    path: trip.to,
                                    coordinates: [trip.to_longitude, trip.to_latitude]
                                },
                                distance: trip.distance,
                                fare: {
                                    customer: trip.trip_cost_customer,
                                    driver: trip.trip_cost_driver
                                },
                                weight: trip.weight,
                                material_unit: trip.material_unit
                            }
                        });
                        const driverData = await User.findById(driverId);
                        if (driverData?.fcm_token) {
                            await sendRejectionTripNotification(driverData.fcm_token, {
                                _id: trip_id as mongoose.Types.ObjectId,
                                type: "driver",
                                response: `Trip ${trip_id} has been assigned to another driver`
                            });
                        }
                        return notification.save();
                    });
                    await Promise.all(rejectionNotifications);
                }
                return res.status(200).send(successHandler('Trip accepted successfully', updatedTrip));
            }

            const all_responses = trip.driver_responses.map((el) => el.response);
            const all_rejected = all_responses.every(dr => dr === 'rejected');
            if (all_rejected) {
                await Trip.findByIdAndUpdate(
                    trip_id,
                    {
                        status: 'cancelled'
                    },
                    { new: true }
                );
            }

            return res.status(200).send(successHandler('Trip rejected successfully'));
        } catch (error: any) {
            console.error('Error responding to trip:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error.message));
        }
    },

    async fetchAllNotifications(req: Request, res: Response): Promise<Response> {
        try {
            const user_id = req.user?._id;
            const role = req.user?.type;

            const {
                page = '1',
                limit = '10',
                trip_id,
                response,
            } = req.query;

            const pageNum = Math.max(parseInt(page as string) || 1, 1);
            const limitNum = Math.max(parseInt(limit as string) || 10, 1);
            const offset = (pageNum - 1) * limitNum;

            if (!user_id) {
                return res.status(400).send(errorHandler('Required field is missing.'));
            }

            if (!mongoose.Types.ObjectId.isValid(user_id as string)) {
                return res.status(400).send(errorHandler('Invalid user ID'));
            }

            const query: any = {};

            if (user_id) {
                query.user = new mongoose.Types.ObjectId(user_id as string);
            };

            if (role == "driver") {
                query.notify_to = "driver";
            }
            if (role == "customer") {
                query.notify_to = "customer";
            }
            if (response) { // accepted or rejected
                query.user_response = response;
            }
            if (trip_id) {
                query.related_trip = new mongoose.Types.ObjectId(trip_id as string);
            }

            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            const yesterdayDate = new Date(currentDate);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);

            const [notifications, total] = await Promise.all([
                Notification.find(query)
                    .lean()
                    .then(notifications => {
                        return notifications.sort((a, b) => {
                            const aDate = new Date(a.createdAt || new Date());
                            aDate.setHours(0, 0, 0, 0);

                            const bDate = new Date(b.createdAt || new Date());
                            bDate.setHours(0, 0, 0, 0);

                            if (aDate.getTime() === currentDate.getTime() &&
                                bDate.getTime() !== currentDate.getTime()) {
                                return -1;
                            }
                            if (bDate.getTime() === currentDate.getTime() &&
                                aDate.getTime() !== currentDate.getTime()) {
                                return 1;
                            }

                            if (aDate.getTime() === yesterdayDate.getTime() &&
                                bDate.getTime() !== yesterdayDate.getTime()) {
                                return -1;
                            }
                            if (bDate.getTime() === yesterdayDate.getTime() &&
                                aDate.getTime() !== yesterdayDate.getTime()) {
                                return 1;
                            }

                            return new Date(b.createdAt || new Date()).getTime() -
                                new Date(a.createdAt || new Date()).getTime();
                        });
                    })
                    .then(sortedNotifications => {
                        return sortedNotifications.slice(offset, offset + limitNum);
                    }),
                Notification.countDocuments(query)
            ]);

            const upated_notification = [];
            for (let i = 0; i < notifications.length; i++) {
                const trip_id = notifications[i]?.metadata?.trip_id;
                if (trip_id) {
                    const tripDoc = await Trip.findById(trip_id).select('status');
                    if (tripDoc && tripDoc.status === "searching") {
                        upated_notification.push({ ...notifications[i], ...{ is_read: false } });
                    } else {
                        upated_notification.push({ ...notifications[i], ...{ is_read: true } });
                    }
                }
            }

            return res.status(200).send(successHandler('Notifications fetched successfully', upated_notification, {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            }));

        } catch (error) {
            console.error('Error fetching notifications:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async editTrip(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).send(errorHandler('Invalid trip ID'));
            }

            const {
                alternate_contact_no,
                material,
                material_unit,
                weight,
                status,
                is_payment_done,
                assisstant,
                vehicle_details,
                user_status,
                ...otherFields
            } = req.body;

            // Validate material ID if provided
            if (material && !mongoose.Types.ObjectId.isValid(material)) {
                return res.status(400).send(errorHandler('Invalid Material ID'));
            }

            // Validate vehicle ID if provided
            if (vehicle_details && !mongoose.Types.ObjectId.isValid(vehicle_details)) {
                return res.status(400).send(errorHandler('Invalid Vehicle ID'));
            }

            // Validate alternate contact number if provided
            if (alternate_contact_no) {
                if (!isValidMobile(alternate_contact_no)) {
                    return res.status(400).send(errorHandler('Contact number is invalid, Enter valid contact number.'));
                }
            }

            // Validate assistants count if provided
            if (assisstant !== undefined && (assisstant < 0 || assisstant > 5)) {
                return res.status(400).send(errorHandler('Assistant count must be between 0 and 5'));
            }

            const existingTrip = await Trip.findById(id);
            if (!existingTrip) {
                return res.status(404).send(errorHandler('Trip not found'));
            }

            // Validate status if provided
            if (status) {
                const validStatuses = ["scheduled", "searching", "loading", "in_transit", "unloading", "delivered", "cancelled", "failed_delivery", "delayed", "returned"];
                if (!validStatuses.includes(status)) {
                    return res.status(400).send(errorHandler('Invalid trip status'));
                }
            }

            const updateData: Partial<ITrip> = {
                ...otherFields,
                updatedAt: new Date()
            };

            // Handle status change and status_stack update
            if (status && status !== existingTrip.status) {
                updateData.status = status;

                const newStatusEntry = {
                    stack_id: statusStack(status),
                    status: status,
                    createdAt: new Date()
                };

                const currentStack = Array.isArray(existingTrip.status_stack)
                    ? existingTrip.status_stack
                    : [];

                updateData.status_stack = [
                    ...currentStack,
                    newStatusEntry
                ];
            }

            // Standard field updates
            if (alternate_contact_no !== undefined) updateData.alternate_contact_no = alternate_contact_no;
            if (material) updateData.material = material;
            if (material_unit) updateData.material_unit = material_unit;
            if (weight) updateData.weight = weight;
            if (is_payment_done !== undefined) updateData.is_payment_done = is_payment_done;
            if (assisstant !== undefined) updateData.assisstant = assisstant;
            if (vehicle_details) updateData.vehicle_details = vehicle_details;

            // Handle date field
            if (otherFields.eta_pickup) {
                updateData.eta_pickup = new Date(otherFields.eta_pickup);
            }

            if (otherFields.from_latitude !== undefined) {
                updateData.from_latitude = otherFields.from_latitude;
            }
            if (otherFields.from_longitude !== undefined) {
                updateData.from_longitude = otherFields.from_longitude;
            }
            if (otherFields.to_latitude !== undefined) {
                updateData.to_latitude = otherFields.to_latitude;
            }
            if (otherFields.to_longitude !== undefined) {
                updateData.to_longitude = otherFields.to_longitude;
            }

            if (otherFields.total_toll_tax_amount !== undefined) {
                updateData.total_toll_tax_amount = otherFields.total_toll_tax_amount;
            }
            if (otherFields.total_tolls !== undefined) {
                updateData.total_tolls = otherFields.total_tolls;
            }
            if (otherFields.customer_freight !== undefined) {
                updateData.customer_freight = parseFloat(otherFields.customer_freight);
            }
            if (otherFields.driver_freight !== undefined) {
                updateData.driver_freight = parseFloat(otherFields.driver_freight);
            }
            if (otherFields.app_charges !== undefined) {
                updateData.app_charges = parseFloat(otherFields.app_charges);
            }

            if (user_status) {
                const trip_amount_customer = typeof existingTrip.trip_cost_customer === 'number' ? existingTrip.trip_cost_customer : 0;
                const trip_amount_driver = typeof existingTrip.trip_cost_driver === 'number' ? existingTrip.trip_cost_driver : 0;

                // Update customer credits
                await User.findByIdAndUpdate(
                    existingTrip.user,
                    {
                        $inc: { total_credits: -trip_amount_customer }
                    },
                    { new: true }
                );

                const new_credit_customer = new Credit({
                    user: existingTrip.user,
                    credit: {
                        amount: -trip_amount_customer,
                        trip: existingTrip._id,
                        stack_type: "trip_credit",
                        createdAt: new Date()
                    }
                });

                await new_credit_customer.save();

                // Update driver credits 
                await User.findByIdAndUpdate(
                    existingTrip.driver,
                    {
                        $inc: { total_credits: trip_amount_driver },
                    },
                    { new: true }
                );

                const new_credit_driver = new Credit({
                    user: existingTrip.driver,
                    credit: {
                        amount: trip_amount_driver,
                        trip: existingTrip._id,
                        stack_type: "trip_credit",
                        createdAt: new Date()
                    }
                });

                await new_credit_driver.save();
            }

            const updatedTrip = await Trip.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            );

            return res.status(200).send(successHandler('Trip updated successfully', updatedTrip));

        } catch (error: any) {
            console.error('Error updating trip:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async fetchTrip(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).send(errorHandler('Invalid trip ID'));
            }

            const trip = await Trip.findById(id)
                .populate({
                    path: 'user',
                    select: 'username fullname name email contact_no profile type'
                })
                .populate({
                    path: 'driver',
                    select: 'username fullname name email contact_no'
                })
                .populate({
                    path: 'material',
                    select: 'name weight type'
                })
                .populate({
                    path: 'vehicle_details',
                    select: 'vehicle_no vehicle_type vehicle_image weight length width height',
                    populate: {
                        path: 'vehicle_type',
                        select: 'name wheeler capacity unit base_fare km_fare base_fare_margin km_fare_margin vehicle_image'
                    }
                })
                .lean();

            if (!trip) {
                return res.status(404).send(errorHandler('Trip not found'));
            }

            return res.status(200).send(successHandler('Trip fetched successfully', trip));

        } catch (error: any) {
            console.error('Error fetching trip:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async fetchTrips(req: Request, res: Response): Promise<Response> {
        try {
            const {
                user,
                status,
                material,
                vehicle_details,
                assisstant,
                tab,
                page = '1',
                limit = '10',
                search = ''
            } = req.query;

            // Pagination
            const pageNum = parseInt(page as string) || 1;
            const limitNum = parseInt(limit as string) || 10;
            const skip = (pageNum - 1) * limitNum;
            const searchText = (search as string).trim();

            // Build query
            const query: any = {};

            if (user) {
                if (!mongoose.Types.ObjectId.isValid(user as string)) {
                    return res.status(400).send(errorHandler('Invalid user ID'));
                }
                query.user = user;
            }

            if (searchText && searchText.length >= 3) {
                const userList = await User.find({
                    $or: [
                        { name: { $regex: searchText, $options: 'i' } },
                        { fullname: { $regex: searchText, $options: 'i' } },
                        { username: { $regex: searchText, $options: 'i' } }
                    ]
                }).select('_id').lean();

                const searchConditions: Array<{
                    from?: { $regex: string; $options: string };
                    to?: { $regex: string; $options: string };
                    user?: { $in: mongoose.Types.ObjectId[] };
                }> = [
                        { from: { $regex: searchText, $options: 'i' } },
                        { to: { $regex: searchText, $options: 'i' } }
                    ];

                if (userList.length > 0) {
                    searchConditions.push({
                        user: { $in: userList.map(user => user._id) }
                    } as any);
                }

                query.$or = searchConditions;
            }

            if (material) {
                if (!mongoose.Types.ObjectId.isValid(material as string)) {
                    return res.status(400).send(errorHandler('Invalid material ID'));
                }
                query.material = material;
            }

            if (vehicle_details) {
                if (!mongoose.Types.ObjectId.isValid(vehicle_details as string)) {
                    return res.status(400).send(errorHandler('Invalid vehicle ID'));
                }
                query.vehicle_details = vehicle_details;
            }

            if (assisstant) {
                const assisstantNum = parseInt(assisstant as string);
                if (assisstantNum < 0 || assisstantNum > 5) {
                    return res.status(400).send(errorHandler('Assistant count must be between 0 and 5'));
                }
                query.assisstant = assisstantNum;
            }

            if (status) {
                const validStatuses = ["scheduled", "searching", "loading", "in_transit", "unloading", "delivered", "cancelled", "failed_delivery", "delayed", "returned"];
                if (!validStatuses.includes(status as string)) {
                    return res.status(400).send(errorHandler('Invalid status filter'));
                }
                query.status = status;
            }

            if (tab) {
                if (tab === "booking") {
                    query.status = { $in: ["scheduled", "loading", "in_transit", "unloading", "delayed"] };
                } else if (tab === "history") {
                    query.status = { $in: ["delivered", "cancelled", "failed_delivery", "returned"] };
                }
            }

            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            const tomorrowDate = new Date(currentDate);
            tomorrowDate.setDate(tomorrowDate.getDate() + 1);

            const [trips, total] = await Promise.all([
                Trip.find(query)
                    .populate({
                        path: 'user',
                        select: 'username fullname name email contact_no'
                    })
                    .populate({
                        path: 'material',
                        select: 'name weight type'
                    })
                    .populate({
                        path: 'vehicle_details',
                        select: 'vehicle_no vehicle_type',
                        populate: {
                            path: 'vehicle_type',
                            select: 'name wheeler capacity'
                        }
                    })
                    .lean()
                    .then(trips => {
                        return trips.sort((a, b) => {
                            const aTripDate = a.eta_pickup ? new Date(a.eta_pickup) : new Date(a.createdAt || new Date());
                            const bTripDate = b.eta_pickup ? new Date(b.eta_pickup) : new Date(b.createdAt || new Date());

                            const aDate = new Date(aTripDate);
                            aDate.setHours(0, 0, 0, 0);
                            const bDate = new Date(bTripDate);
                            bDate.setHours(0, 0, 0, 0);

                            if (aDate.getTime() === currentDate.getTime() && bDate.getTime() !== currentDate.getTime()) {
                                return -1;
                            }
                            if (bDate.getTime() === currentDate.getTime() && aDate.getTime() !== currentDate.getTime()) {
                                return 1;
                            }

                            if (aDate.getTime() === tomorrowDate.getTime() && bDate.getTime() !== tomorrowDate.getTime()) {
                                return -1;
                            }
                            if (bDate.getTime() === tomorrowDate.getTime() && aDate.getTime() !== tomorrowDate.getTime()) {
                                return 1;
                            }

                            if (aDate > currentDate && bDate > currentDate) {
                                return aDate.getTime() - bDate.getTime();
                            }

                            if (aDate < currentDate && bDate < currentDate) {
                                return bDate.getTime() - aDate.getTime();
                            }

                            if (aDate > currentDate && bDate < currentDate) {
                                return -1;
                            }
                            if (aDate < currentDate && bDate > currentDate) {
                                return 1;
                            }

                            return new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime();
                        });
                    })
                    .then(sortedTrips => {
                        return sortedTrips.slice(skip, skip + limitNum);
                    })
                ,
                Trip.countDocuments(query)
            ]);

            return res.status(200).send(successHandler('Trips fetched successfully', trips, {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            }));

        } catch (error: any) {
            console.error('Error fetching trips:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async deleteTrip(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.params;
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).send(errorHandler('Invalid trip ID'));
            }

            const deletedTrip = await Trip.findByIdAndDelete(id);
            if (!deletedTrip) {
                return res.status(404).send(errorHandler('Trip not found'));
            }

            return res.status(200).send(successHandler('Trip deleted successfully'));

        } catch (error: any) {
            console.error('Error deleting trip:', error);
            return res.status(500).send(errorHandler('Internal Server Error'));
        }
    },

    async findNearbyDrivers(req: Request, res: Response): Promise<Response> {
        try {
            const { longitude, latitude, maxDistance = 10 } = req.query;

            if (!longitude || !latitude) {
                return res.status(400).send(errorHandler('Longitude and latitude are required'));
            }

            const drivers = await DriverLocation.find({
                location: {
                    $nearSphere: {
                        $geometry: {
                            type: "Point",
                            coordinates: [parseFloat(longitude as string), parseFloat(latitude as string)]
                        },
                        $maxDistance: parseFloat(maxDistance as string) * 1000 // Convert km to meters
                    }
                }
            })
                .populate({
                    path: 'user',
                    match: {
                        status: 'active',
                        availability: 'online',
                        type: 'driver'
                    },
                    select: 'fullname email contact_no vehicle_details'
                })
                .lean();

            return res.status(200).send(successHandler('Nearby drivers fetched successfully', drivers));
        } catch (error) {
            console.error('Error finding nearby drivers:', error);
            return res.status(500).send(errorHandler('Internal Server Error', error));
        }
    },

    async sendNotificationToScheduleTrips(req: Request, res: Response): Promise<Response> {
        try {
            const now = new Date();
            const windowAround = (minutes: number) => ({
                $gte: new Date(now.getTime() + (minutes - 1) * 60 * 1000),
                $lt: new Date(now.getTime() + (minutes + 1) * 60 * 1000)
            });

            const [tripsIn30Min, tripsIn5Min] = await Promise.all([
                Trip.find({ eta_pickup: windowAround(30), status: 'scheduled' }),
                Trip.find({ eta_pickup: windowAround(5), status: 'scheduled' })
            ]);

            const notifyDrivers = async (trips: any[], reminderTime: number) => {
                for (const trip of trips) {
                    const driverIds = trip.potential_drivers || [];

                    for (const driverId of driverIds) {
                        const driver = await User.findById(driverId);
                        if (driver?.fcm_token) {
                            await sendTripNotification(driver.fcm_token, {
                                _id: trip._id as mongoose.Types.ObjectId,
                                trip_cost_customer: trip.trip_cost_customer ? trip.trip_cost_customer : 0,
                                trip_cost_driver: trip.trip_cost_driver ? trip.trip_cost_driver : 0,
                                type: "driver",
                                from: trip.from,
                                to: trip.to
                            });

                            console.log(`Sent ${reminderTime} min notification to driver ${driverId} for trip ${trip._id}`);
                        }
                    }
                }
            };

            await Promise.all([
                notifyDrivers(tripsIn30Min, 30),
                notifyDrivers(tripsIn5Min, 5)
            ]);

            return res.status(200).send(successHandler('Trip reminders sent to drivers.'));
        } catch (error) {
            console.error('Error sending trip notifications:', error);
            return res.status(500).send({ status: 'error', message: 'Internal Server Error', error });
        }
    },

    async notifyMessage(req: Request, res: Response): Promise<Response> {
        try {
            const { driver_id } = req.params;
            const { data_type } = req.query;
            if (!driver_id) {
                return res.status(400).send(errorHandler('Missing user id'));
            }
            const user = await User.findById(driver_id);
            if (!user) {
                return res.status(400).send(errorHandler('User not found'));
            }

            let responseData;
            if (user.fcm_token) {
                responseData = await sendOverlayNotification(user.fcm_token, String(data_type) || "trigger_overlay", "");
            }

            return res.status(200).send(successHandler('Notification sended sucessfully.', responseData));
        } catch (error) {
            console.error('Error sending trip notifications:', error);
            return res.status(500).send({ status: 'error', message: 'Internal Server Error', error });
        }
    },

    async testNotification(req: Request, res: Response): Promise<Response> {
        try {
            const { id } = req.query;
            if (!id) {
                return res.status(400).send(errorHandler('Missing user id'));
            }
            const user = await User.findById(id);
            if (!user) {
                return res.status(400).send(errorHandler('User not found'));
            }

            let responseData;
            if (user.fcm_token) {
                responseData = await sendTestNotification(user.fcm_token, {
                    _id: new mongoose.Types.ObjectId(id as string),
                    trip_cost_customer: 500,
                    trip_cost_driver: 400,
                    type: "driver",
                    from: "Dummay Source",
                    to: "Dummay Destination"
                });
            }

            return res.status(200).send(successHandler('Notification sended sucessfully.', responseData));
        } catch (error) {
            console.error('Error sending trip notifications:', error);
            return res.status(500).send({ status: 'error', message: 'Internal Server Error', error });
        }
    },

    async fetchTripsByUserFilter(req: Request, res: Response): Promise<Response> {
        try {
            const {
                user,
                trip_status,
                vehicle_details,
                tab,
                page = '1',
                limit = '10',
                search = '',
                driver_response,
                driver_id
            } = req.query;

            const pageNum = parseInt(page as string) || 1;
            const limitNum = parseInt(limit as string) || 10;
            const skip = (pageNum - 1) * limitNum;
            const searchText = (search as string).trim();

            const query: any = {};

            if (user) {
                if (!mongoose.Types.ObjectId.isValid(user as string)) {
                    return res.status(400).send(errorHandler('Invalid user ID'));
                }
                query.user = user;
            }

            if (driver_response && driver_id) {
                if (!mongoose.Types.ObjectId.isValid(driver_id as string)) {
                    return res.status(400).send(errorHandler('Invalid driver ID'));
                }

                if (!['accepted', 'rejected'].includes(driver_response as string)) {
                    return res.status(400).send(errorHandler('Invalid driver response filter (use "accepted" or "rejected")'));
                }

                query['driver_responses'] = {
                    $elemMatch: {
                        driver: new mongoose.Types.ObjectId(driver_id as string),
                        response: driver_response
                    }
                };
            }

            if (searchText && searchText.length >= 3) {
                const userList = await User.find({
                    $or: [
                        { name: { $regex: searchText, $options: 'i' } },
                        { fullname: { $regex: searchText, $options: 'i' } },
                        { username: { $regex: searchText, $options: 'i' } }
                    ]
                }).select('_id').lean();

                const searchConditions: Array<{
                    from?: { $regex: string; $options: string };
                    to?: { $regex: string; $options: string };
                    user?: { $in: mongoose.Types.ObjectId[] };
                }> = [
                        { from: { $regex: searchText, $options: 'i' } },
                        { to: { $regex: searchText, $options: 'i' } }
                    ];

                if (userList.length > 0) {
                    searchConditions.push({
                        user: { $in: userList.map(user => user._id) }
                    } as any);
                }

                query.$or = searchConditions;
            }

            if (vehicle_details) {
                if (!mongoose.Types.ObjectId.isValid(vehicle_details as string)) {
                    return res.status(400).send(errorHandler('Invalid vehicle ID'));
                }
                query.vehicle_details = vehicle_details;
            }

            if (trip_status) {
                const validStatuses = ["scheduled", "searching", "loading", "in_transit", "unloading", "delivered", "cancelled", "failed_delivery", "delayed", "returned"];
                if (!validStatuses.includes(trip_status as string)) {
                    return res.status(400).send(errorHandler('Invalid status filter'));
                }
                query.status = trip_status;
            }

            if (tab) {
                if (tab === "booking") {
                    query.status = { $in: ["scheduled", "loading", "in_transit", "unloading", "delayed"] };
                } else if (tab === "history") {
                    query.status = { $in: ["delivered", "cancelled", "failed_delivery", "returned"] };
                }
            }

            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            const tomorrowDate = new Date(currentDate);
            tomorrowDate.setDate(tomorrowDate.getDate() + 1);

            const [trips, total] = await Promise.all([
                Trip.find(query)
                    .populate({
                        path: 'user',
                        select: 'username fullname name email contact_no'
                    })
                    .populate({
                        path: 'material',
                        select: 'name weight type'
                    })
                    .populate({
                        path: 'vehicle_details',
                        select: 'vehicle_no vehicle_type',
                        populate: {
                            path: 'vehicle_type',
                            select: 'name wheeler capacity'
                        }
                    })
                    .lean()
                    .then(trips => {
                        return trips.sort((a, b) => {
                            const aTripDate = a.eta_pickup ? new Date(a.eta_pickup) : new Date(a.createdAt || new Date());
                            const bTripDate = b.eta_pickup ? new Date(b.eta_pickup) : new Date(b.createdAt || new Date());

                            const aDate = new Date(aTripDate);
                            aDate.setHours(0, 0, 0, 0);
                            const bDate = new Date(bTripDate);
                            bDate.setHours(0, 0, 0, 0);

                            if (aDate.getTime() === currentDate.getTime() && bDate.getTime() !== currentDate.getTime()) {
                                return -1;
                            }
                            if (bDate.getTime() === currentDate.getTime() && aDate.getTime() !== currentDate.getTime()) {
                                return 1;
                            }

                            if (aDate.getTime() === tomorrowDate.getTime() && bDate.getTime() !== tomorrowDate.getTime()) {
                                return -1;
                            }
                            if (bDate.getTime() === tomorrowDate.getTime() && aDate.getTime() !== tomorrowDate.getTime()) {
                                return 1;
                            }

                            if (aDate > currentDate && bDate > currentDate) {
                                return aDate.getTime() - bDate.getTime();
                            }

                            if (aDate < currentDate && bDate < currentDate) {
                                return bDate.getTime() - aDate.getTime();
                            }

                            if (aDate > currentDate && bDate < currentDate) {
                                return -1;
                            }
                            if (aDate < currentDate && bDate > currentDate) {
                                return 1;
                            }

                            return new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime();
                        });
                    })
                    .then(sortedTrips => {
                        return sortedTrips.slice(skip, skip + limitNum);
                    }),
                Trip.countDocuments(query)
            ]);

            return res.status(200).send(successHandler('Trips fetched successfully', trips, {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            }));

        } catch (error) {
            console.error('Error fetching trips:', error);
            return res.status(500).send({ status: 'error', message: 'Internal Server Error', error });
        }
    },

    async retryTrip(req: Request, res: Response): Promise<Response> {
        try {
            const { trip_id } = req.params;
            if (trip_id) {
                if (!mongoose.Types.ObjectId.isValid(trip_id)) {
                    return res.status(400).send(errorHandler('Invalid vehicle type ID'));
                }
            }

            const trip = await Trip.findOne({ _id: trip_id, status: "cancelled" });

            if (!trip) {
                return res.status(404).send(errorHandler('Trip not found or not cancelled'));
            }

            const vehicle_users = await Vehicle.find({ vehicle_type: trip.vehicle_type }).select('user');
            const vehicle_users_modified = vehicle_users.map((ele) => ele.user != null && ele.user.toString());
            const unique_vehicle_users = [...new Set(vehicle_users_modified)];


            // Find nearby drivers within 10KM using geospatial query
            // const driverLocations = await DriverLocation.find({
            //     location: {
            //         $nearSphere: {
            //             $geometry: {
            //                 type: "Point",
            //                 coordinates: [parseFloat(from_longitude as string), parseFloat(from_latitude as string)]
            //             },
            //             $maxDistance: MAX_DISTANCE_KM * 1000 // Convert km to meters
            //         }
            //     }
            // })
            //     .populate({
            //         path: 'user',
            //         match: {
            //             status: 'active',
            //             availability: 'online',
            //             type: 'driver'
            //         },
            //         select: 'fullname email contact_no vehicle_details'
            //     })
            //     .lean(); previous code

            const driverLocations = await DriverLocation.find()
                .populate({
                    path: 'user',
                    match: {
                        status: 'active',
                        // availability: 'online',
                        type: 'driver'
                    },
                    select: 'fullname email contact_no vehicle_details'
                })
                .lean();

            const runningStatuses = ['loading', 'in_transit', 'unloading'];

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const runningTrips = await Trip.find({
                status: { $in: runningStatuses },
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                driver_responses: {
                    $elemMatch: {
                        response: 'accepted'
                    }
                }
            }).select('driver_responses');

            const busyDriverIds = new Set();
            for (const trip of runningTrips) {
                for (const dr of trip.driver_responses) {
                    if (dr.response === 'accepted') {
                        busyDriverIds.add(dr.driver.toString());
                    }
                }
            }

            // const availableDrivers = driverLocations.filter(dl =>
            //    dl.user !== null && !busyDriverIds.has(dl.user?._id.toString()) && unique_vehicle_users.includes(dl.user?._id.toString())
            // ); previous code
            const all_drivers = await User.find({ type: "driver" }).lean(); // for testing
            const availableDrivers = all_drivers.filter(dl => unique_vehicle_users.includes(dl._id.toString())); // for testing


            // const uniqueDriversMap = new Map();
            // availableDrivers.forEach(driver => {
            //     const userId = driver.user._id.toString();
            //     if (!uniqueDriversMap.has(userId)) {
            //         uniqueDriversMap.set(userId, driver);
            //     }
            // });

            // const uniqueAvailableDrivers = [...uniqueDriversMap.values()];

            const uniqueAvailableDrivers = availableDrivers; // for testing

            const driverResponses = uniqueAvailableDrivers.map(driver => ({
                // driver: driver.user._id,
                driver: driver._id, // for testing
                response: 'pending',
                responded_at: null
            }));

            // // Update trip with potential drivers
            await Trip.findByIdAndUpdate(trip._id, {
                $set: { potential_drivers: uniqueAvailableDrivers.map(d => d._id) }, // d.user._id
                $push: { driver_responses: { $each: driverResponses } }
            });

            // // Send notifications to available drivers
            const notificationPromises = uniqueAvailableDrivers.map(async (driverLocation) => {
                const notification = new Notification({
                    user: driverLocation._id,  // driverLocation.user._id
                    title: 'New Trip Request',
                    message: `New trip available from ${trip.from} to ${trip.to}`,
                    type: 'trip_request',
                    related_id: trip._id,
                    notify_to: "driver", // driver , customer
                    metadata: {
                        trip_id: trip._id,
                        from_location: {
                            path: trip.from,
                            coordinates: [trip.from_longitude, trip.from_latitude]
                        },
                        to_location: trip.to_longitude && trip.to_latitude ?
                            {
                                path: trip.to,
                                coordinates: [trip.to_longitude, trip.to_latitude]
                            } : null,
                        distance: trip.distance,
                        fare: {
                            customer: trip.trip_cost_customer,
                            driver: trip.trip_cost_driver
                        },
                        weight: trip.weight,
                        material_unit: trip.material_unit
                    }
                });

                const driver = await User.findById(driverLocation._id).select('fcm_token'); // driverLocation.user._id

                if (driver?.fcm_token) {
                    await sendTripNotification(driver.fcm_token, {
                        _id: trip._id as mongoose.Types.ObjectId,
                        trip_cost_customer: trip.trip_cost_customer ? trip.trip_cost_customer : 0,
                        trip_cost_driver: trip.trip_cost_driver ? trip.trip_cost_driver : 0,
                        type: "driver",
                        from: trip.from ? trip.from : "",
                        to: trip.to ? trip.to : "",
                        eta_pickup: String(trip.eta_pickup) || ""
                    });
                }
                return notification.save();
            });

            await Promise.all(notificationPromises);
            return res.status(201).send(successHandler('Notification again"s send sucessfully', trip, {
                available_drivers: uniqueAvailableDrivers.length,
                notified_drivers: uniqueAvailableDrivers.map(d => d._id) // d.user._id

            }));

        } catch (error) {
            console.error('Error fetching trips:', error);
            return res.status(500).send({ status: 'error', message: 'Internal Server Error', error });
        }
    }
}

export default tripController;