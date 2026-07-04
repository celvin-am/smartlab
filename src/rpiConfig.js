// Raspberry Pi backend endpoint for website fingerprint registration.
// Set this to the Raspberry Pi address and port where the controller is running.
// You can also override this with Vite env: VITE_RPI_ENDPOINT.

const defaultEndpoint = 'http://192.168.1.10:5001'
export const RPI_ENDPOINT = import.meta.env.VITE_RPI_ENDPOINT || defaultEndpoint
