export const toSocketBaseUrl = (httpBaseUrl: string): string => {
    return httpBaseUrl.replace(/\/api\/?$/, '');
};
