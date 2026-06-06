import { renderTextToBmp } from '../hebrewToBmp';
import type { Show, Slide } from '../types';
import { EvenHubService } from './evenHubService';

const DB_NAME = 'EyePromptBMPStorage';
const DB_VERSION = 1;
const STORE_NAME = 'bmpFiles';

interface BMPFile {
  showId: string;
  slideId: string;
  bmpData: Uint8Array;
  timestamp: number;
}

export class BMPStorageService {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<boolean> {
    return new Promise((resolve, _reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: ['showId', 'slideId'] });
          objectStore.createIndex('showId', 'showId', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Save BMP images for all slides in a show
   */
  async saveShowBMPs(show: Show): Promise<boolean> {
    if (!this.db) {
      const initialized = await this.init();
      if (!initialized) {
        console.error('Failed to initialize IndexedDB');
        return false;
      }
    }
    if (!this.db) return false;

    try {
      // Delete old BMPs for this show if updating
      await this.deleteShowBMPs(show.id);

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Generate BMP for each slide (use same dimensions as EvenHubService)
      const SLIDE_IMAGE_WIDTH = EvenHubService.SLIDE_IMAGE_WIDTH;
      const SLIDE_IMAGE_HEIGHT = EvenHubService.SLIDE_IMAGE_HEIGHT;
      
      const savePromises = show.slides.map(async (slide: Slide) => {
        const bmp = renderTextToBmp(
          slide.content.trim() || ' ',
          SLIDE_IMAGE_WIDTH,
          SLIDE_IMAGE_HEIGHT,
          show.style
        );

        const bmpFile: BMPFile = {
          showId: show.id,
          slideId: slide.id,
          bmpData: bmp,
          timestamp: Date.now(),
        };

        return new Promise<void>((resolve, reject) => {
          const request = store.put(bmpFile);
          request.onsuccess = () => {
            console.log(`Saved BMP for slide: ${slide.id}`);
            resolve();
          };
          request.onerror = () => {
            console.error(`Failed to save BMP for slide: ${slide.id}`, request.error);
            reject(request.error);
          };
        });
      });

      await Promise.all(savePromises);
      console.log(`Successfully saved ${show.slides.length} BMP files for show: ${show.name}`);
      return true;
    } catch (error) {
      console.error('Failed to save show BMPs:', error);
      return false;
    }
  }

  /**
   * Delete all BMPs for a show (delete "folder")
   */
  async deleteShowBMPs(showId: string): Promise<boolean> {
    if (!this.db) {
      const initialized = await this.init();
      if (!initialized) return false;
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('showId');
      const request = index.openCursor(IDBKeyRange.only(showId));

      const keysToDelete: IDBValidKey[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          keysToDelete.push(cursor.primaryKey);
          cursor.continue();
        } else {
          // Delete all keys
          if (keysToDelete.length === 0) {
            console.log(`No BMP files found for show: ${showId}`);
            resolve(true);
            return;
          }

          const deletePromises = keysToDelete.map((key) => {
            return new Promise<void>((resolveDelete) => {
              const deleteRequest = store.delete(key);
              deleteRequest.onsuccess = () => resolveDelete();
              deleteRequest.onerror = () => {
                console.error('Failed to delete BMP:', deleteRequest.error);
                resolveDelete();
              };
            });
          });

          Promise.all(deletePromises).then(() => {
            console.log(`Deleted ${keysToDelete.length} BMP files for show: ${showId}`);
            resolve(true);
          });
        }
      };

      request.onerror = () => {
        console.error('Failed to delete show BMPs:', request.error);
        resolve(false);
      };
    });
  }

}

export const bmpStorageService = new BMPStorageService();
