
import { supabase } from '../store/supabase';

export const StorageService = {
  /**
   * Shvaća datoteku i sprema je u 'TRIMLY' bucket.
   * Vraća javni URL slike ili null ako upload padne.
   */
  uploadPhoto: async (file: File, path: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${path}/${fileName}`;

      // PAŽNJA: Ime bucketa mora biti točno 'TRIMLY' kao na vašem screenshotu
      const { error: uploadError, data } = await supabase.storage
        .from('TRIMLY')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Dopusti prepisivanje ako treba
        });

      if (uploadError) {
        console.error('Supabase Storage Upload Error:', uploadError);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('TRIMLY')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('General Storage Error:', error);
      return null;
    }
  }
};
