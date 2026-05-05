const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase environment variables missing. Storage uploads will fail.');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

/**
 * Uploads a file buffer to Supabase Storage and returns the public URL.
 * 
 * @param {string} bucketName - The name of the bucket (e.g., 'uploads')
 * @param {string} filePath - The path/filename inside the bucket
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} contentType - The mime type of the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
async function uploadToSupabase(bucketName, filePath, fileBuffer, contentType) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType: contentType,
      upsert: true,
    });

  if (error) {
    console.error('Supabase Storage Error:', error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

module.exports = {
  supabase,
  uploadToSupabase
};
