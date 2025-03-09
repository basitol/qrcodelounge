import React, {useState, useEffect} from 'react';
import {Document, Page, pdfjs} from 'react-pdf';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function MenuPage() {
  const [imageUrls, setImageUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuVersion, setMenuVersion] = useState(1);

  // Get credentials from environment variables
  const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'deg8w4agm';

  useEffect(() => {
    // Try to get the image URLs from localStorage
    const savedUrls = localStorage.getItem('menuImageUrls');
    const savedVersion = localStorage.getItem('menuVersion');

    if (savedUrls) {
      setImageUrls(JSON.parse(savedUrls));
      if (savedVersion) {
        setMenuVersion(parseInt(savedVersion, 10));
      }
      setLoading(false);
    } else {
      // Try to fetch default images if they exist
      const checkDefaultImages = async () => {
        try {
          // First try to determine the latest version
          let latestVersion = 1;
          let versionFound = false;

          // Try versions 1-10 to find the latest
          for (let v = 10; v >= 1; v--) {
            try {
              const versionResponse = await fetch(
                `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-v${v}-page-1.jpg`,
              );
              if (versionResponse.ok) {
                latestVersion = v;
                versionFound = true;
                break;
              }
            } catch {
              // Continue checking
            }
          }

          // If no versioned menu found, try the unversioned format
          if (!versionFound) {
            const response = await fetch(
              `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-1.jpg`,
            );
            if (response.ok) {
              versionFound = true;
            }
          }

          if (versionFound) {
            // Now fetch all pages for the found version
            const urls = [];
            let pageCount = 0;
            let checking = true;

            while (checking) {
              pageCount++;
              try {
                const pageUrl =
                  versionFound && latestVersion > 1
                    ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-v${latestVersion}-page-${pageCount}.jpg`
                    : `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-${pageCount}.jpg`;

                const pageResponse = await fetch(pageUrl);
                if (pageResponse.ok) {
                  urls.push(pageUrl);
                } else {
                  checking = false;
                }
              } catch {
                checking = false;
              }

              // Safety check to prevent infinite loop
              if (pageCount > 50) checking = false;
            }

            if (urls.length > 0) {
              setImageUrls(urls);
              setMenuVersion(latestVersion);
              setLoading(false);

              // Save to localStorage for future use
              localStorage.setItem('menuImageUrls', JSON.stringify(urls));
              localStorage.setItem('menuVersion', latestVersion.toString());
            } else {
              setError('No menu images found');
              setLoading(false);
            }
          } else {
            setError('No menu available. Please check back later.');
            setLoading(false);
          }
        } catch (err) {
          console.error('Error checking for default images:', err);
          setError('Failed to load menu. Please try again later.');
          setLoading(false);
        }
      };

      checkDefaultImages();
    }
  }, [CLOUD_NAME]);

  if (loading) {
    return (
      <div className='menu-loading' style={styles.loading}>
        <div className='spinner' style={styles.spinner}></div>
        <p>Loading menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='menu-error' style={styles.error}>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className='menu-container' style={styles.container}>
      {imageUrls.length > 0 ? (
        <div style={styles.menuContent}>
          {/* Restaurant name or logo could go here */}
          <div style={styles.menuHeader}>
            <h1 style={styles.menuTitle}>Our Menu</h1>
          </div>

          {/* Continuous scrollable menu */}
          <div style={styles.menuPages}>
            {imageUrls.map((url, index) => (
              <div key={index} style={styles.menuPage}>
                <img
                  src={url}
                  alt={`Menu page ${index + 1}`}
                  style={styles.menuImage}
                  loading='lazy' // Lazy load images for better performance
                />
              </div>
            ))}
          </div>

          {/* Optional footer */}
          <div style={styles.menuFooter}>
            <p style={styles.footerText}>Thank you for dining with us!</p>
          </div>
        </div>
      ) : (
        <div style={styles.noMenu}>
          <p>No menu available. Please check back later.</p>
        </div>
      )}
    </div>
  );
}

// Updated styles for continuous scrolling layout
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    maxWidth: '100%',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9f9f9',
  },
  menuContent: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  menuHeader: {
    width: '100%',
    textAlign: 'center',
    padding: '20px 0',
    marginBottom: '10px',
  },
  menuTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#333',
    margin: 0,
  },
  menuPages: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px', // Space between menu pages
  },
  menuPage: {
    width: '100%',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  menuImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  menuFooter: {
    width: '100%',
    textAlign: 'center',
    padding: '20px 0',
    marginTop: '20px',
  },
  footerText: {
    fontSize: '16px',
    color: '#666',
    fontStyle: 'italic',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80vh',
  },
  spinner: {
    border: '4px solid rgba(0, 0, 0, 0.1)',
    borderLeft: '4px solid #3498db',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px',
  },
  error: {
    textAlign: 'center',
    color: '#e74c3c',
    padding: '40px 20px',
  },
  retryButton: {
    padding: '10px 20px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '20px',
  },
  noMenu: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#7f8c8d',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    width: '80%',
    maxWidth: '600px',
  },
};

// Add keyframe animation for spinner
if (typeof document !== 'undefined') {
  const styleSheet = document.styleSheets[0];
  try {
    styleSheet.insertRule(
      `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `,
      styleSheet.cssRules.length,
    );
  } catch (e) {
    console.error('Failed to insert CSS rule for spinner animation', e);
  }
}

export default MenuPage;
