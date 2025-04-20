import {ref, set, get, onValue, off} from 'firebase/database';
import {database} from '../firebase';
import axios from 'axios';
import {ref as storageRef, uploadBytes, getDownloadURL} from 'firebase/storage';
import {storage} from '../firebase';

// Ensure your constants use the latest environment variables
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

// Add some logging to debug
console.log('Using Cloudinary config:', {
  cloudName: CLOUD_NAME,
  uploadPreset: UPLOAD_PRESET,
});

class MenuService {
  constructor() {
    this.menuRef = ref(database, 'menu');
    this.historyRef = ref(database, 'menu_history');
    this.listeners = [];
  }

  // Get the current menu
  async getCurrentMenu() {
    try {
      const snapshot = await get(this.menuRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error getting current menu:', error);
      return await this.getFallbackMenu();
    }
  }

  // Subscribe to menu updates
  subscribeToMenu(callback) {
    const onMenuUpdate = onValue(
      this.menuRef,
      snapshot => {
        const menuData = snapshot.exists() ? snapshot.val() : null;
        if (menuData && menuData.imageUrls && menuData.imageUrls.length > 0) {
          callback({
            success: true,
            data: menuData,
          });
        } else {
          // Try to get fallback menu
          this.getFallbackMenu().then(fallbackMenu => {
            if (fallbackMenu) {
              callback({
                success: true,
                data: fallbackMenu,
                fromFallback: true,
              });
            } else {
              callback({
                success: false,
                error: 'No menu available',
              });
            }
          });
        }
      },
      error => {
        console.error('Menu subscription error:', error);
        this.getFallbackMenu().then(fallbackMenu => {
          if (fallbackMenu) {
            callback({
              success: true,
              data: fallbackMenu,
              fromFallback: true,
            });
          } else {
            callback({
              success: false,
              error: error.message,
            });
          }
        });
      },
    );

    this.listeners.push({ref: this.menuRef, handler: onMenuUpdate});
    return () => {
      off(this.menuRef, 'value', onMenuUpdate);
      this.listeners = this.listeners.filter(l => l.handler !== onMenuUpdate);
    };
  }

  // Unsubscribe all listeners
  unsubscribeAll() {
    this.listeners.forEach(({ref, handler}) => {
      off(ref, 'value', handler);
    });
    this.listeners = [];
  }

  // Save a new menu
  async saveMenu(imageUrls, pdfUrl = null) {
    try {
      // Get current menu for versioning
      const currentMenu = await this.getCurrentMenu();

      // Determine the new version using alphanumeric scheme
      let newVersion;

      if (
        currentMenu?.version &&
        typeof currentMenu.version === 'string' &&
        currentMenu.version.match(/^\d+[a-z]$/)
      ) {
        // If current version is in format "1a", "2b", etc.
        const currentNumber = parseInt(
          currentMenu.version.match(/^(\d+)[a-z]$/)[1],
        );
        const currentLetter = currentMenu.version.slice(-1);
        const nextLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);

        // If we reach "z", move to next number
        if (nextLetter > 'z') {
          newVersion = `${currentNumber + 1}a`;
        } else {
          newVersion = `${currentNumber}${nextLetter}`;
        }
      } else {
        // Start with "1a"
        newVersion = '1a';
      }

      // Create new menu data
      const menuData = {
        imageUrls,
        version: newVersion,
        lastUpdated: new Date().toISOString(),
        pageCount: imageUrls.length,
        pdfUrl: pdfUrl, // Optional PDF URL
      };

      // Save to Firebase
      await set(this.menuRef, menuData);

      // Save previous menu to history
      if (currentMenu && currentMenu.imageUrls?.length > 0) {
        const historySnapshot = await get(this.historyRef);
        let history = historySnapshot.exists() ? historySnapshot.val() : [];

        if (!Array.isArray(history)) {
          history = [];
        }

        // Add current menu to history
        history.push({
          ...currentMenu,
          timestamp: new Date().toISOString(),
        });

        // Limit history to 5 entries
        if (history.length > 5) {
          history = history.slice(history.length - 5);
        }

        // Save history
        await set(this.historyRef, history);
      }

      return {
        success: true,
        data: menuData,
      };
    } catch (error) {
      console.error('Error saving menu:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Restore a previous menu
  async restoreMenu(historicalMenu) {
    try {
      // Get current menu version for comparison
      const currentMenu = await this.getCurrentMenu();
      let newVersion;

      if (
        currentMenu?.version &&
        typeof currentMenu.version === 'string' &&
        currentMenu.version.match(/^\d+[a-z]$/)
      ) {
        // If current version is in format "1a", "2b", etc.
        const currentNumber = parseInt(
          currentMenu.version.match(/^(\d+)[a-z]$/)[1],
        );
        const currentLetter = currentMenu.version.slice(-1);
        const nextLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);

        // If we reach "z", move to next number
        if (nextLetter > 'z') {
          newVersion = `${currentNumber + 1}a`;
        } else {
          newVersion = `${currentNumber}${nextLetter}`;
        }
      } else {
        // Start with "1a"
        newVersion = '1a';
      }

      // Create restored menu data
      const menuData = {
        imageUrls: historicalMenu.imageUrls,
        version: newVersion,
        lastUpdated: new Date().toISOString(),
        pageCount: historicalMenu.imageUrls.length,
        restoredFrom: historicalMenu.version,
        pdfUrl: historicalMenu.pdfUrl,
      };

      // Save to Firebase
      await set(this.menuRef, menuData);

      return {
        success: true,
        data: menuData,
      };
    } catch (error) {
      console.error('Error restoring menu:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get menu history
  async getMenuHistory() {
    try {
      const snapshot = await get(this.historyRef);
      return snapshot.exists() ? snapshot.val() : [];
    } catch (error) {
      console.error('Error getting menu history:', error);
      return [];
    }
  }

  // Fallback to Cloudinary direct check if Firebase fails
  async getFallbackMenu() {
    try {
      console.log('Attempting to fetch fallback menu from Cloudinary');

      // Try to find menus with the new versioning scheme first
      for (let num = 10; num >= 1; num--) {
        for (let letterCode = 122; letterCode >= 97; letterCode--) {
          // 'z' to 'a'
          const letter = String.fromCharCode(letterCode);
          const version = `${num}${letter}`;

          try {
            const response = await fetch(
              `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-${version}-page-1.jpg`,
              {method: 'HEAD'},
            );

            if (response.ok) {
              // Found versioned menu, collect all pages
              const urls = [];
              let pageCount = 1;
              let checking = true;

              while (checking) {
                try {
                  const pageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-${version}-page-${pageCount}.jpg`;
                  console.log('cloud name', CLOUD_NAME);
                  const pageResponse = await fetch(pageUrl, {method: 'HEAD'});

                  if (pageResponse.ok) {
                    urls.push(pageUrl);
                    pageCount++;
                  } else {
                    checking = false;
                  }
                } catch {
                  checking = false;
                }

                // Safety check
                if (pageCount > 50) checking = false;
              }

              if (urls.length > 0) {
                return {
                  imageUrls: urls,
                  version: version,
                  lastUpdated: new Date().toISOString(),
                  pageCount: urls.length,
                  fromFallback: true,
                };
              }
            }
          } catch {
            // Continue checking
          }
        }
      }

      // If new versioning scheme not found, try the old numeric versioning
      // (rest of the method remains unchanged)
      try {
        const response = await fetch(
          `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-1.jpg`,
          {method: 'HEAD'},
        );

        if (response.ok) {
          // Found unversioned menu, collect all pages
          const urls = [];
          let pageCount = 1;
          let checking = true;

          while (checking) {
            try {
              const pageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-${pageCount}.jpg`;
              const pageResponse = await fetch(pageUrl, {method: 'HEAD'});

              if (pageResponse.ok) {
                urls.push(pageUrl);
                pageCount++;
              } else {
                checking = false;
              }
            } catch {
              checking = false;
            }

            // Safety check
            if (pageCount > 50) checking = false;
          }

          if (urls.length > 0) {
            return {
              imageUrls: urls,
              version: 'unversioned',
              lastUpdated: new Date().toISOString(),
              pageCount: urls.length,
              fromFallback: true,
            };
          }
        }
      } catch {
        // No unversioned menu found
      }

      // No menu found
      return null;
    } catch (error) {
      console.error('Error getting fallback menu:', error);
      return null;
    }
  }

  // Upload PDF and convert to images
  async uploadPdfAsImages(pdfFile, onProgress = () => {}, pdfjs) {
    try {
      // No longer uploading the PDF to Cloudinary
      onProgress({step: 'processing', progress: 0});

      // Now get the current menu to determine next version
      const currentMenu = await this.getCurrentMenu();
      const nextVersion = (currentMenu?.version || 0) + 1;

      // Use pdfjs to render each page
      // Use the passed in pdfjs instance
      if (!pdfjs) {
        throw new Error('PDF.js instance is required for PDF processing');
      }

      // Create a local URL for the PDF file for processing
      const pdfUrl = URL.createObjectURL(pdfFile);

      // Load the PDF
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      // Process each page to an image
      const uploadedUrls = [];

      for (let i = 1; i <= totalPages; i++) {
        // Render the page to a canvas
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({scale: 2.0});

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        // Convert canvas to blob
        const blob = await new Promise(resolve => {
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
        });

        // Create a file from the blob
        const imageFile = new File(
          [blob],
          `menu-v${nextVersion}-page-${i}.jpg`,
          {
            type: 'image/jpeg',
          },
        );

        // Upload the image
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', 'menus');
        formData.append('public_id', `menu-v${nextVersion}-page-${i}`);

        // Add timestamp metadata to the first image
        if (i === 1) {
          formData.append('context', `timestamp=${new Date().toISOString()}`);
        }

        const response = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
          formData,
        );

        uploadedUrls.push(response.data.secure_url);

        onProgress({
          step: 'processing',
          progress: Math.round((i / totalPages) * 100),
          currentPage: i,
          totalPages,
        });
      }

      // Clean up the object URL
      URL.revokeObjectURL(pdfUrl);

      // Save menu data to Firebase (no PDF URL)
      const result = await this.saveMenu(uploadedUrls, null);

      return {
        success: true,
        imageUrls: uploadedUrls,
        version: nextVersion,
      };
    } catch (error) {
      console.error('Error uploading PDF as images:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Upload images
  async uploadImages(imageFiles, pdfFile = null, onProgress = () => {}) {
    try {
      // Get current menu for versioning
      const currentMenu = await this.getCurrentMenu();

      // Determine the new version using alphanumeric scheme
      let newVersion;

      if (
        currentMenu?.version &&
        typeof currentMenu.version === 'string' &&
        currentMenu.version.match(/^\d+[a-z]$/)
      ) {
        // If current version is in format "1a", "2b", etc.
        const currentNumber = parseInt(
          currentMenu.version.match(/^(\d+)[a-z]$/)[1],
        );
        const currentLetter = currentMenu.version.slice(-1);
        const nextLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);

        // If we reach "z", move to next number
        if (nextLetter > 'z') {
          newVersion = `${currentNumber + 1}a`;
        } else {
          newVersion = `${currentNumber}${nextLetter}`;
        }
      } else {
        // Start with "1a"
        newVersion = '1a';
      }

      console.log(`Creating new menu version: ${newVersion}`); // Add logging

      // No longer uploading PDF files, even if provided
      let pdfUrl = null;

      // Upload each image to Cloudinary instead of Firebase Storage
      const uploadedUrls = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const pageNumber = i + 1;

        try {
          // Create FormData for Cloudinary
          const formData = new FormData();
          formData.append('file', imageFile);
          formData.append('upload_preset', UPLOAD_PRESET);
          formData.append('folder', 'menus');
          formData.append('public_id', `menu-${newVersion}-page-${pageNumber}`);

          // Upload to Cloudinary
          const response = await axios.post(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
            formData,
            {
              onUploadProgress: progressEvent => {
                const progress = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total,
                );
                onProgress({
                  step: 'uploading',
                  progress: Math.round(
                    (i * 100 + progress) / imageFiles.length,
                  ),
                  currentFile: pageNumber,
                  totalFiles: imageFiles.length,
                });
              },
            },
          );

          uploadedUrls.push(response.data.secure_url);
        } catch (error) {
          console.error(`Error uploading image ${pageNumber}:`, error);
        }
      }

      // Save to Firebase
      const saveResult = await this.saveMenu(uploadedUrls, null);

      if (!saveResult.success) {
        throw new Error(`Failed to save menu to Firebase: ${saveResult.error}`);
      }

      return {
        success: true,
        imageUrls: uploadedUrls,
        version: newVersion,
      };
    } catch (error) {
      console.error('Error uploading images:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export default new MenuService();
