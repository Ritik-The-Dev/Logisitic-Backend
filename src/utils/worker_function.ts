export function isValidMobile(number: any) {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(number);
}