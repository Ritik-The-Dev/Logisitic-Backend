import { SUCESS, FAILED } from '../config/constant';

interface ResponseRest {
    [key: string]: any;
}

interface SuccessResponse<T = any> {
    status: string;
    message: string;
    data?: T;
    [key: string]: any;
}

interface ErrorResponse {
    status: string;
    message: string;
    error?: any;
}

export function successHandler<T = any>(message: string, data?: T, rest?: ResponseRest): SuccessResponse<T> {
    try {
        return { status: SUCESS, message, ...(data !== undefined && { data }), ...(rest || {}) };
    } catch (error) {
        return { status: FAILED, message: 'An unexpected error occurred', error };
    }
}

export function errorHandler(message: string, error?: any): ErrorResponse {
    try {
        return { status: FAILED, message, ...(error !== undefined && { error }) };
    } catch (err) {
        return { status: FAILED, message: 'An unexpected error occurred', error: err, };
    }
}
