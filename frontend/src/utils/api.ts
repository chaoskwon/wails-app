export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(options.headers || {});

  const uuid = localStorage.getItem('AUTH_MACHINE_UUID');
  const machineId = localStorage.getItem('AUTH_MACHINE_ID');

  if (uuid) {
    headers.set('X-Machine-UUID', uuid);
  }
  if (machineId) {
    headers.set('X-Machine-ID', machineId);
  }

  // Ensure content-type json if not defined and method is POST/PUT
  // if (!headers.has('Content-Type') && (options.method === 'POST' || options.method === 'PUT')) {
  //   headers.set('Content-Type', 'application/json');
  // }
  // Let's not assume this, as some requests might be FormData

  const newOptions = {
    ...options,
    headers,
  };

  return fetch(url, newOptions);
};
