
import { supabase } from '../store/supabase';

export const StorageService = {
  /**
   * Uploads a file to the Supabase Storage 'trimly' bucket.
   * Path should be 'profiles', 'gallery', or 'services'.
   */
  uploadPhoto: async (file: File, path: string): Promise<{ url: string | null, error: string | null }> => {
    try {
      if (!file) return { url: null, error: 'Datoteka nije odabrana.' };
      
      // Provjera veličine (npr. max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return { url: null, error: 'Slika je prevelika. Maksimalna veličina je 5MB.' };
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${path}/${cleanFileName}`;

      console.log(`LOG: Započinjem upload u bucket 'trimly', putanja: ${filePath}...`);

      const { error: uploadError } = await supabase.storage
        .from('trimly')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage Upload Error Detail:', uploadError);
        let errorMsg = uploadError.message;
        
        if (errorMsg.includes('bucket not found')) {
          errorMsg = "Spremnik 'trimly' ne postoji. Pokrenite SQL skriptu.";
        } else if (errorMsg.toLowerCase().includes('row-level security') || errorMsg.includes('403')) {
          errorMsg = "Pristup odbijen (RLS polisa). Provjerite storage postavke u Supabaseu.";
        }
        
        return { url: null, error: errorMsg };
      }

      const { data } = supabase.storage
        .from('trimly')
        .getPublicUrl(filePath);

      if (!data || !data.publicUrl) {
        return { url: null, error: 'Nije moguće dohvatiti javni link slike.' };
      }

      console.log('✅ Upload uspješan. Dobiveni URL:', data.publicUrl);
      return { url: data.publicUrl, error: null };
    } catch (error: any) {
      console.error('Critical Storage Exception:', error);
      return { url: null, error: error.message || 'Sistemska greška pri uploadu.' };
    }
  }
};
