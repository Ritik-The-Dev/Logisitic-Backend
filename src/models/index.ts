import Credit, { ICredit } from './credit_stack.model';
import Vehicle_Document, { IVehicleDocument } from './driver/vehicle_document.model';
import User, { IUser } from './users.model';
import Trip, { ITrip } from './driver/trips.model';
import User_session, { IUserSession } from './driver/user_sessions.model';
import Vehicle, { IVehicle } from './driver/vehicle.model';
import VehicleType, { IVehicleType } from './driver/vehicle_type.model';
import Material, { IMaterial } from './driver/material_box.model';

const AllModels = {
  User,
  Trip,
  User_session,
  VehicleType,
  Vehicle,
  Vehicle_Document,
  Material,
  Credit
};

export default AllModels;

export type { IUser, ITrip, IUserSession, IVehicleDocument, IVehicle, IVehicleType, IMaterial, ICredit };
