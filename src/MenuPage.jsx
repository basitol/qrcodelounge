import React, {useState, useEffect} from 'react';
import {Document, Page, pdfjs} from 'react-pdf';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function MenuPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get credentials from environment variables
  const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

  useEffect(() => {
    // Try to get the image URLs from localStorage
    const savedUrls = localStorage.getItem('menuImageUrls');
    const savedTotalPages = localStorage.getItem('menuTotalPages');

    if (savedUrls && savedTotalPages) {
      setImageUrls(JSON.parse(savedUrls));
      setTotalPages(parseInt(savedTotalPages, 10));
      setLoading(false);
    } else {
      // Try to fetch default images if they exist
      const checkDefaultImages = async () => {
        try {
          // Check if we can access the first image
          const response = await fetch(
            `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-1.jpg`,
          );

          if (response.ok) {
            // If first image exists, try to find how many pages there are
            let pageCount = 1;
            const defaultUrls = [
              `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-1.jpg`,
            ];

            // Try to find more pages (up to a reasonable limit)
            for (let i = 2; i <= 20; i++) {
              try {
                const nextResponse = await fetch(
                  `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-${i}.jpg`,
                );
                if (nextResponse.ok) {
                  pageCount++;
                  defaultUrls.push(
                    `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/menu-page-${i}.jpg`,
                  );
                } else {
                  break;
                }
              } catch {
                break;
              }
            }

            if (pageCount > 0) {
              setImageUrls(defaultUrls);
              setTotalPages(pageCount);
              setLoading(false);
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

  function changePage(offset) {
    setCurrentPage(prevPage => {
      const newPage = prevPage + offset;
      return Math.max(1, Math.min(newPage, totalPages));
    });
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

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
        <>
          <div style={styles.imageContainer}>
            <img
              src={imageUrls[currentPage - 1]}
              alt={`Menu page ${currentPage}`}
              style={styles.menuImage}
            />
          </div>

          {totalPages > 1 && (
            <div
              className='pagination-controls'
              style={styles.paginationControls}>
              <button
                type='button'
                disabled={currentPage <= 1}
                onClick={previousPage}
                style={{
                  ...styles.pageButton,
                  opacity: currentPage <= 1 ? 0.5 : 1,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                }}>
                Previous
              </button>
              <p style={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </p>
              <button
                type='button'
                disabled={currentPage >= totalPages}
                onClick={nextPage}
                style={{
                  ...styles.pageButton,
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                }}>
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={styles.noMenu}>
          <p>No menu available. Please check back later.</p>
        </div>
      )}
    </div>
  );
}

// Styles
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
  imageContainer: {
    maxWidth: '100%',
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
  paginationControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '20px',
    gap: '15px',
  },
  pageButton: {
    padding: '10px 20px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.3s ease',
  },
  pageInfo: {
    margin: '0',
    fontSize: '16px',
    color: '#333',
    fontWeight: '500',
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
