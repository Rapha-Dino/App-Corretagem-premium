export const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (error) => reject(error));
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg');
};

export const calculateAge = (birthday: string) => {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const getCleanClient = (client: any) => {
  if (!client) return null;
  const clean = { ...client };
  
  if (!clean.andar && clean.outros && clean.outros.includes('[Andar: ')) {
    const match = clean.outros.match(/\[Andar: (.*?)\]/);
    if (match) {
      clean.andar = match[1];
      clean.outros = clean.outros.replace(/\[Andar: .*?\]\s*/, '');
    }
  }
  
  return clean;
};

export const getClientPhoto = (client: any) => {
  const clean = getCleanClient(client);
  const url = clean?.foto_url;
  if (!url || url.includes('picsum.photos')) return null;
  return url;
};

export const getCleanOthers = (others: string | null) => {
  if (!others) return 'Nenhuma nota registrada.';
  const clean = getCleanClient({ outros: others });
  return clean?.outros || 'Nenhuma nota registrada.';
};

export const cleanPhoneNumberForWhatsApp = (phone: string) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
};
