
import { supabase } from '../store/supabase';

export const StorageService = {
  /**
   * Uploads a file to the Supabase Storage 'trimly' bucket.
   * Path should be 'profiles', 'gallery', or 'services'.
   */
  uploadPhoto: async (file: File, path: string): Promise<string | null> => {
    try {
      if (!file) return null;
      
      // Sanitize filename to avoid weird characters
      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${path}/${cleanFileName}`;

      // CRITICAL: Bucket name MUST match dashboard exactly ('trimly' not 'TRIMLY')
      const { error: uploadError } = await supabase.storage
        .from('trimly')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        // Log details so developer can see them in browser console
        console.error('Storage: Upload Failed. Check bucket name and RLS policies.', uploadError);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('trimly')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Storage: Unexpected exception during upload:', error);
      return null;
    }
  }
};
