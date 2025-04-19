import React, {useState, useEffect} from 'react';
import {Document, Page, pdfjs} from 'react-pdf';
import {ref, onValue} from 'firebase/database';
import {database} from './firebase';
import MenuService from './services/MenuService';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Get credentials from environment variables
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'deg8w4agm';

// Add this after your existing imports
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

function MenuPage() {
  const [imageUrls, setImageUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebugInfo, setShowDebugInfo] = useState(IS_DEVELOPMENT);
  const [menuInfo, setMenuInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Function to fetch the latest menu images
  const fetchLatestMenuImages = async () => {
    setLoading(true);

    // Create debug collection object
    const debug = {
      device: {
        userAgent: navigator.userAgent,
        isMobile: /Mobile|Android|iPhone/i.test(navigator.userAgent),
        screenWidth: window.innerWidth,
      },
      environment: process.env.NODE_ENV,
      checks: [],
      results: {
        versionFound: false,
        latestVersion: 0,
        urlsFound: 0,
      },
      timing: {
        start: new Date().toISOString(),
        duration: 0,
      },
    };

    try {
      // Simple, practical version detection
      let latestVersion = 0;
      let versionFound = false;

      const maxVersionToCheck = 100;

      for (let v = maxVersionToCheck; v >= 1; v--) {
        try {
          // Record what we're checking
          const checkUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-v${v}-page-1.jpg`;
          const checkStart = Date.now();

          // Try to fetch this version
          const response = await fetch(checkUrl, {method: 'HEAD'});

          // Record result and timing
          debug.checks.push({
            version: v,
            url: checkUrl,
            status: response.status,
            ok: response.ok,
            timeMs: Date.now() - checkStart,
          });

          if (response.ok) {
            latestVersion = v;
            versionFound = true;

            // Update debug info
            debug.results.versionFound = true;
            debug.results.latestVersion = v;

            break;
          }
        } catch (err) {
          // Continue checking but record error
          debug.checks.push({
            version: v,
            error: err.message,
          });
        }
      }

      // Now fetch all pages for the latest version
      if (versionFound) {
        const urls = [];
        let pageCount = 1;
        let checking = true;

        while (checking) {
          try {
            const pageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-v${latestVersion}-page-${pageCount}.jpg`;

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

          // Safety check to prevent infinite loop
          if (pageCount > 50) checking = false;
        }

        if (urls.length > 0) {
          setImageUrls(urls);
          setLastChecked(new Date());

          // Update debug info
          debug.results.urlsFound = urls.length;
          debug.results.firstUrl = urls[0];
          debug.results.lastUrl = urls[urls.length - 1];
        } else {
          setError('No menu pages found');
          debug.results.error = 'No menu pages found';
        }
      } else {
        setError('No menu available. Please check back later.');
        debug.results.error = 'No menu available';
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
      setError('Failed to load menu. Please try again later.');
      debug.results.error = err.message;
    } finally {
      setLoading(false);

      // Finalize debug info
      debug.timing.end = new Date().toISOString();
      debug.timing.duration = new Date() - new Date(debug.timing.start);
      setDebugInfo(debug);
    }
  };

  useEffect(() => {
    // Subscribe to menu updates from Firebase
    const unsubscribe = MenuService.subscribeToMenu(result => {
      setLoading(false);
      setRefreshing(false);

      if (result.success) {
        console.log('Menu Page received new menu data:', result.data); // Add logging
        setImageUrls(result.data.imageUrls);
        setMenuInfo({
          version: result.data.version,
          lastUpdated: new Date(result.data.lastUpdated),
          pageCount: result.data.pageCount,
          fromFallback: result.fromFallback,
        });
        setError(null);
      } else {
        setError(result.error || 'Failed to load menu');
        // Keep existing menu if we have one
        if (imageUrls.length === 0) {
          setImageUrls([]);
        }
      }
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const menu = await MenuService.getCurrentMenu();
      if (menu) {
        setImageUrls(menu.imageUrls);
        setMenuInfo({
          version: menu.version,
          lastUpdated: new Date(menu.lastUpdated),
          pageCount: menu.pageCount,
          fromFallback: menu.fromFallback,
        });
        setError(null);
      } else {
        // Try fallback
        const fallback = await MenuService.getFallbackMenu();
        if (fallback) {
          setImageUrls(fallback.imageUrls);
          setMenuInfo({
            version: fallback.version,
            lastUpdated: new Date(fallback.lastUpdated),
            pageCount: fallback.pageCount,
            fromFallback: true,
          });
          setError(null);
        } else {
          setError('No menu available. Please check back later.');
        }
      }
    } catch (err) {
      console.error('Error refreshing menu:', err);
      setError('Failed to refresh menu');
    } finally {
      setRefreshing(false);
    }
  };

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
        <button onClick={handleRefresh} style={styles.retryButton}>
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
            {menuInfo && (
              <p style={styles.menuInfo}>
                Version {menuInfo.version} •
                {menuInfo.lastUpdated && (
                  <>
                    Last updated: {menuInfo.lastUpdated.toLocaleDateString()} at{' '}
                    {menuInfo.lastUpdated.toLocaleTimeString()}
                    {menuInfo.fromFallback && ' (Fallback version)'}
                  </>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  style={{
                    ...styles.refreshButton,
                    opacity: refreshing ? 0.7 : 1,
                    cursor: refreshing ? 'not-allowed' : 'pointer',
                  }}
                  aria-label='Refresh menu'>
                  {refreshing ? '↻ Refreshing...' : '↻'}
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
                  onError={e => {
                    // Replace broken images with a placeholder
                    e.target.src =
                      'https://via.placeholder.com/800x1200?text=Menu+Image+Not+Available';
                  }}
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
          <button onClick={handleRefresh} style={styles.retryButton}>
            Check Again
          </button>
        </div>
      )}

      {/* Debug info panel - add this at the end */}
      {showDebugInfo && (
        <div style={styles.debugPanel}>
          <div
            style={styles.debugHeader}
            onClick={() => setShowDebugInfo(!showDebugInfo)}>
            Debug Info {showDebugInfo ? '▼' : '▶'}
          </div>
          {showDebugInfo && (
            <pre style={styles.debugContent}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
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
  menuInfo: {
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
  debugPanel: {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    width: '300px',
    maxHeight: '400px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#00ff00',
    borderRadius: '5px',
    fontSize: '12px',
    zIndex: 9999,
    overflow: 'hidden',
  },
  debugHeader: {
    padding: '8px',
    backgroundColor: '#333',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  debugContent: {
    padding: '8px',
    maxHeight: '350px',
    overflow: 'auto',
    margin: 0,
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
