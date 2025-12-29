export const getSiteUrl = () => {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ?? 
    process.env.NEXT_PUBLIC_VERCEL_URL ?? 
    'http://localhost:3000';

  url = url.includes('http') ? url : `https://${url}`;
  url = url.charAt(url.length - 1) === '/' ? url.slice(0, -1) : url;
  return url;
};

export const getBackendUrl = () => {
  let url = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  
  console.log('[Config] Raw NEXT_PUBLIC_BACKEND_URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
  console.log('[Config] Initial URL:', url);

  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }

  url = url.charAt(url.length - 1) === '/' ? url.slice(0, -1) : url;
  
  console.log('[Config] Final Backend URL:', url);
  return url;
};
