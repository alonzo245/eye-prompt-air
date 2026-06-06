import type { Show } from '../types';
import { bmpStorageService } from './bmpStorageService';

const STORAGE_KEY_SHOWS = 'eye_prompt_shows';

export class StorageService {
  private bridge: any = null;

  setBridge(bridge: any) {
    this.bridge = bridge;
  }

  /**
   * Generic get: EvenHub SDK storage first, then localStorage fallback.
   */
  async getItem(key: string): Promise<string> {
    try {
      if (this.bridge) {
        try {
          const value = await this.bridge.getLocalStorage(key);
          if (value != null && value !== '') return value;
        } catch (error) {
          console.warn('EvenHub storage read failed, falling back to localStorage:', error);
        }
      }
      return localStorage.getItem(key) ?? '';
    } catch (error) {
      console.error('Failed to get item:', error);
      return '';
    }
  }

  /**
   * Generic set: EvenHub SDK storage first, then localStorage fallback.
   */
  async setItem(key: string, value: string): Promise<boolean> {
    try {
      if (this.bridge) {
        try {
          const result = await this.bridge.setLocalStorage(key, value);
          if (result) return true;
        } catch (error) {
          console.warn('EvenHub storage failed, falling back to localStorage:', error);
        }
      }
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Failed to set item:', error);
      return false;
    }
  }

  /**
   * Save a show using EvenHub SDK storage API, with localStorage fallback
   * Also saves BMP images for all slides
   */
  async saveShow(show: Show): Promise<boolean> {
    try {
      // Check if this is an update (show already exists)
      const existingShows = await this.getAllShows();
      const isUpdate = existingShows.some(s => s.id === show.id);
      
      // If updating, delete old BMPs first
      if (isUpdate) {
        console.log(`Updating show: ${show.name}, deleting old BMPs...`);
        await bmpStorageService.deleteShowBMPs(show.id);
      }
      
      // Save BMP images for all slides
      console.log(`Saving BMP images for show: ${show.name}...`);
      const bmpSaved = await bmpStorageService.saveShowBMPs(show);
      if (!bmpSaved) {
        console.warn('Failed to save BMP images, but continuing with show save');
      }
      
      const shows = existingShows.filter(s => s.id !== show.id);
      shows.push(show);
      
      const data = JSON.stringify(shows);
      
      // Try EvenHub SDK storage first
      if (this.bridge) {
        try {
          const result = await this.bridge.setLocalStorage(STORAGE_KEY_SHOWS, data);
          if (result) {
            console.log(`Show saved successfully: ${show.name}`);
            return true;
          }
        } catch (error) {
          console.warn('EvenHub storage failed, falling back to localStorage:', error);
        }
      }
      
      // Fallback to localStorage
      localStorage.setItem(STORAGE_KEY_SHOWS, data);
      console.log(`Show saved successfully: ${show.name}`);
      return true;
    } catch (error) {
      console.error('Failed to save show:', error);
      return false;
    }
  }

  /**
   * Get all saved shows
   */
  async getAllShows(): Promise<Show[]> {
    try {
      let data: string | null = null;
      
      // Try EvenHub SDK storage first
      if (this.bridge) {
        try {
          data = await this.bridge.getLocalStorage(STORAGE_KEY_SHOWS);
        } catch (error) {
          console.warn('EvenHub storage read failed, falling back to localStorage:', error);
        }
      }
      
      // Fallback to localStorage
      if (!data) {
        data = localStorage.getItem(STORAGE_KEY_SHOWS);
      }
      
      if (!data) {
        return [];
      }
      
      const shows: Show[] = JSON.parse(data);
      // Sort by creation date (newest first)
      return shows.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Failed to load shows:', error);
      return [];
    }
  }

  /**
   * Get a specific show by ID
   */
  async getShow(id: string): Promise<Show | null> {
    const shows = await this.getAllShows();
    return shows.find(s => s.id === id) || null;
  }

  /**
   * Delete a show and its associated BMP images
   */
  async deleteShow(id: string): Promise<boolean> {
    try {
      // Delete BMP images for this show
      console.log(`Deleting BMP images for show: ${id}...`);
      await bmpStorageService.deleteShowBMPs(id);
      
      const shows = await this.getAllShows();
      const updatedShows = shows.filter(s => s.id !== id);
      const data = JSON.stringify(updatedShows);
      
      // Try EvenHub SDK storage first
      if (this.bridge) {
        try {
          const result = await this.bridge.setLocalStorage(STORAGE_KEY_SHOWS, data);
          if (result) {
            console.log(`Show and BMPs deleted successfully: ${id}`);
            return true;
          }
        } catch (error) {
          console.warn('EvenHub storage failed, falling back to localStorage:', error);
        }
      }
      
      // Fallback to localStorage
      localStorage.setItem(STORAGE_KEY_SHOWS, data);
      console.log(`Show and BMPs deleted successfully: ${id}`);
      return true;
    } catch (error) {
      console.error('Failed to delete show:', error);
      return false;
    }
  }
}

export const storageService = new StorageService();
