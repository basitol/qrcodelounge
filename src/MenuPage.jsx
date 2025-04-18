import React, {useState, useEffect} from 'react';
import {Document, Page, pdfjs} from 'react-pdf';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Get credentials from environment variables
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'deg8w4agm';

function MenuPage() {
  const [imageUrls, setImageUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  // Function to fetch the latest menu images
  const fetchLatestMenuImages = async () => {
    setLoading(true);
    try {
      // Simple, practical version detection
      let latestVersion = 0;
      let versionFound = false;

      // Start from a reasonable maximum and work backwards
      // This balances efficiency with simplicity
      const maxVersionToCheck = 100; // Well above your current v40-something

      for (let v = maxVersionToCheck; v >= 1; v--) {
        try {
          const response = await fetch(
            `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-v${v}-page-1.jpg`,
            {method: 'HEAD'},
          );

          if (response.ok) {
            latestVersion = v;
            versionFound = true;
            break;
          }
        } catch {
          // Continue checking
        }
      }

      // Now fetch all pages for the latest version
      if (versionFound) {
        const urls = [];
        let pageCount = 1;
        let checking = true;

        while (checking) {
          try {
            // Construct URL based on whether versioning is used
            const pageUrl =
              versionFound && latestVersion > 0
                ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-v${latestVersion}-page-${pageCount}.jpg`
                : `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-${pageCount}.jpg`;

            const response = await fetch(pageUrl, {method: 'HEAD'});

            if (response.ok) {
              urls.push(pageUrl);
              pageCount++;
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
          setLastChecked(new Date());
        } else {
          setError('No menu pages found');
        }
      } else {
        setError('No menu available. Please check back later.');
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
      setError('Failed to load menu. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchLatestMenuImages();

    // Optional: Set up periodic refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchLatestMenuImages();
    }, 5 * 60 * 1000);

    // Clean up interval on component unmount
    return () => clearInterval(refreshInterval);
  }, []);

  if (loading && imageUrls.length === 0) {
    return (
      <div className='menu-loading' style={styles.loading}>
        <div className='spinner' style={styles.spinner}></div>
        <p>Loading menu...</p>
      </div>
    );
  }

  if (error && imageUrls.length === 0) {
    return (
      <div className='menu-error' style={styles.error}>
        <p>{error}</p>
        <button onClick={fetchLatestMenuImages} style={styles.retryButton}>
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
            {lastChecked && (
              <p style={styles.menuRefreshInfo}>
                Last updated: {lastChecked.toLocaleTimeString()}
                <button
                  onClick={fetchLatestMenuImages}
                  style={styles.refreshButton}
                  aria-label='Refresh menu'>
                  ↻
                </button>
              </p>
            )}
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
  menuRefreshInfo: {
    fontSize: '14px',
    color: '#666',
    margin: '10px 0 0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  refreshButton: {
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
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
