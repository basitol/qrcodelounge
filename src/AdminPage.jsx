import React, {useState, useEffect, useRef} from 'react';
import axios from 'axios';
import {Document, Page, pdfjs} from 'react-pdf';
import MenuService from './services/MenuService';

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Get credentials from environment variables
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'deg8w4agm';
const UPLOAD_PRESET =
  process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'qr_menu';

function AdminPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [currentMenuUrl, setCurrentMenuUrl] = useState(null);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [menuVersion, setMenuVersion] = useState(1);
  const [menuHistory, setMenuHistory] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refs for canvas elements
  const canvasRef = useRef(null);

  // Check if there's already a menu when the page loads
  useEffect(() => {
    const checkExistingMenu = async () => {
      try {
        // Try to fetch the current menu from Cloudinary
        const response = await fetch(
          `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/current-menu.pdf`,
        );

        if (response.ok) {
          setCurrentMenuUrl(
            `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/menus/current-menu.pdf`,
          );
        }
      } catch (err) {
        console.log('No existing menu found');
      }
    };

    checkExistingMenu();
  }, [CLOUD_NAME]);

  useEffect(() => {
    const fetchMenuData = async () => {
      setLoading(true);
      try {
        // Get current menu
        const menu = await MenuService.getCurrentMenu();

        if (menu && menu.imageUrls) {
          setImageUrls(menu.imageUrls);
          setMenuVersion(menu.version || '1a');
        }

        // Get menu history
        const history = await MenuService.getMenuHistory();
        setMenuHistory(Array.isArray(history) ? history : []);
      } catch (err) {
        console.error('Error fetching menu data:', err);
        setError('Failed to load menu data');
      } finally {
        setLoading(false);
      }
    };

    fetchMenuData();

    // Also subscribe to real-time updates
    const unsubscribe = MenuService.subscribeToMenu(result => {
      if (result.success) {
        setImageUrls(result.data.imageUrls);
        setMenuVersion(result.data.version || '1a');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleFileChange = e => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);

      // Check if the file is a PDF
      if (
        selectedFiles.length > 0 &&
        selectedFiles[0].type !== 'application/pdf'
      ) {
        setError('Please upload a PDF file');
        return;
      }

      setFiles(selectedFiles);
      setUploadSuccess(false);
      setError(null);

      // Create a preview URL for the PDF
      if (selectedFiles.length > 0) {
        const previewUrl = URL.createObjectURL(selectedFiles[0]);
        setPdfUrl(previewUrl);
      }
    }
  };

  const handleDrop = e => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);

      // Check if the file is a PDF
      if (
        droppedFiles.length > 0 &&
        droppedFiles[0].type !== 'application/pdf'
      ) {
        setError('Please upload a PDF file');
        return;
      }

      setFiles(droppedFiles);
      setUploadSuccess(false);
      setError(null);

      // Create a preview URL for the PDF
      if (droppedFiles.length > 0) {
        const previewUrl = URL.createObjectURL(droppedFiles[0]);
        setPdfUrl(previewUrl);
      }
    }
  };

  const handleDragOver = e => {
    e.preventDefault();
  };

  const handleRemoveFile = () => {
    setFiles([]);
    setPdfUrl(null);
  };

  const onDocumentLoadSuccess = ({numPages}) => {
    setNumPages(numPages);
  };

  const changePage = offset => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.max(1, Math.min(newPage, numPages));
    });
  };

  const previousPage = () => {
    changePage(-1);
  };

  const nextPage = () => {
    changePage(1);
  };

  // Function to render a PDF page to a canvas and return as a blob
  const renderPageToBlob = async (pdf, pageNum, scale = 2.0) => {
    try {
      // Get the page
      const page = await pdf.getPage(pageNum);

      // Create a canvas if it doesn't exist
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Set scale for good quality
      const viewport = page.getViewport({scale});
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render the page to canvas
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      // Convert canvas to blob
      return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
      });
    } catch (err) {
      console.error('Error rendering page:', err);
      throw err;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select a PDF file');
      return;
    }

    // Check if the file is a PDF
    const file = files[0];
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setProcessingPdf(true);
    setProcessingProgress(0);
    setError(null);
    setUploadProgress(0);

    try {
      // Process the PDF using pdfjs
      // Load the PDF document - using a local object URL to avoid Cloudinary issues
      const fileUrl = URL.createObjectURL(file);
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      // Process each page to an image
      const imageBlobs = [];

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

        imageBlobs.push(blob);

        // Update progress
        setProcessingProgress(Math.round((i / totalPages) * 100));
      }

      // Clean up the URL object
      URL.revokeObjectURL(fileUrl);

      // Convert blobs to files
      const imageFiles = imageBlobs.map((blob, index) => {
        return new File([blob], `page-${index + 1}.jpg`, {
          type: 'image/jpeg',
        });
      });

      // Now use MenuService to upload the images and the PDF
      setProcessingPdf(false);
      setUploading(true);

      const result = await MenuService.uploadImages(
        imageFiles,
        file, // Pass the original PDF file for proper uploading
        progress => {
          setUploadProgress(progress.progress);
        },
      );

      if (result.success) {
        // IMPORTANT: Use the exact same image URLs that were returned
        setImageUrls(result.imageUrls);
        setMenuVersion(result.version);
        setUploadSuccess(true);

        // Remove any local storage versions to avoid confusion
        localStorage.removeItem('menuImageUrls');
        localStorage.removeItem('menuVersion');
        localStorage.removeItem('menuHistory');
      } else {
        setError(result.error || 'Failed to upload images');
      }
    } catch (err) {
      console.error('Error in upload process:', err);
      setError('An unexpected error occurred: ' + err.message);
    } finally {
      setProcessingPdf(false);
      setUploading(false);
      setUploadProgress(0);
      setProcessingProgress(0);
    }
  };

  // Handle complete menu replacement
  const handleReplaceMenu = async () => {
    if (files.length === 0) {
      setError('Please select a PDF file');
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  // Confirm menu replacement
  const confirmReplaceMenu = async () => {
    setShowConfirmDialog(false);

    // Check if the file is a PDF
    const file = files[0];
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setProcessingPdf(true);
    setProcessingProgress(0);
    setError(null);

    try {
      // Save current menu to history before replacing
      if (imageUrls.length > 0) {
        const updatedHistory = [...menuHistory];
        updatedHistory.push({
          version: menuVersion,
          urls: imageUrls,
          date: new Date().toISOString(),
          pageCount: imageUrls.length,
        });

        // Keep only the last 5 versions to save space
        if (updatedHistory.length > 5) {
          updatedHistory.shift();
        }

        setMenuHistory(updatedHistory);
        localStorage.setItem('menuHistory', JSON.stringify(updatedHistory));
      }

      // Increment menu version
      const newVersion = menuVersion + 1;
      setMenuVersion(newVersion);
      localStorage.setItem('menuVersion', newVersion.toString());

      // Load the PDF document
      const fileUrl = URL.createObjectURL(file);
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;

      // Get the total number of pages
      const totalPages = pdf.numPages;
      const imageBlobs = [];

      // Process each page
      for (let i = 1; i <= totalPages; i++) {
        // Update processing progress
        setProcessingProgress(Math.round((i / totalPages) * 50)); // First 50% for processing

        // Render page to blob
        const blob = await renderPageToBlob(pdf, i);
        imageBlobs.push(blob);
      }

      // Clean up
      URL.revokeObjectURL(fileUrl);

      // Now upload each image to Cloudinary with version in the public_id
      setUploading(true);
      setUploadProgress(0);

      const uploadedUrls = [];

      for (let i = 0; i < imageBlobs.length; i++) {
        // Create a file from the blob
        const imageFile = new File([imageBlobs[i]], `page-${i + 1}.jpg`, {
          type: 'image/jpeg',
        });

        // Create FormData with version in the public_id
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', 'menus');
        formData.append('public_id', `menu-v${newVersion}-page-${i + 1}`);

        // Upload to Cloudinary
        const response = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
          formData,
        );

        uploadedUrls.push(response.data.secure_url);

        // Update upload progress (50% to 100%)
        setUploadProgress(50 + Math.round(((i + 1) / imageBlobs.length) * 50));
      }

      // Store the new image URLs in localStorage
      localStorage.setItem('menuImageUrls', JSON.stringify(uploadedUrls));
      localStorage.setItem('menuTotalPages', uploadedUrls.length.toString());

      setImageUrls(uploadedUrls);
      console.log('Menu replaced successfully:', uploadedUrls);
      setUploadSuccess(true);
    } catch (err) {
      console.error('Error processing or uploading:', err);
      setError('Failed to process or upload the PDF. Please try again.');
    } finally {
      setProcessingPdf(false);
      setUploading(false);
      setProcessingProgress(0);
      setUploadProgress(0);
    }
  };

  // Cancel menu replacement
  const cancelReplaceMenu = () => {
    setShowConfirmDialog(false);
  };

  // Restore a previous menu version
  const restorePreviousVersion = async historyItem => {
    try {
      setLoading(true);

      const result = await MenuService.restoreMenu(historyItem);

      if (result.success) {
        setImageUrls(result.data.imageUrls);
        setMenuVersion(result.data.version);
        setUploadSuccess(true);
      } else {
        setError(result.error || 'Failed to restore previous menu version');
      }
    } catch (err) {
      console.error('Error restoring menu version:', err);
      setError('Failed to restore previous menu version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Menu Admin Dashboard</h1>
        <p style={styles.subtitle}>Upload and manage your QR code menu</p>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.uploadSection}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Upload Menu PDF</h2>

            <div
              className='upload-area'
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={styles.uploadArea}>
              <div style={styles.uploadIcon}>
                <svg
                  width='50'
                  height='50'
                  viewBox='0 0 24 24'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'>
                  <path
                    d='M12 16L12 8'
                    stroke='#4A90E2'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M9 11L12 8 15 11'
                    stroke='#4A90E2'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M8 16H16'
                    stroke='#4A90E2'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M3 19H21'
                    stroke='#4A90E2'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </div>
              <p style={styles.uploadText}>
                <strong>Drag and drop your menu PDF here</strong> or click to
                browse
              </p>
              <input
                id='file-upload'
                type='file'
                onChange={handleFileChange}
                accept='application/pdf'
                style={{display: 'none'}}
              />
              <label htmlFor='file-upload' style={styles.browseButton}>
                Select PDF
              </label>
              <p style={styles.supportedFormats}>Supported format: PDF</p>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div style={styles.selectedFiles}>
                <h3 style={styles.sectionTitle}>Selected PDF</h3>
                <div style={styles.fileItem}>
                  <div style={styles.fileIcon}>
                    <svg
                      width='24'
                      height='24'
                      viewBox='0 0 24 24'
                      fill='none'
                      xmlns='http://www.w3.org/2000/svg'>
                      <path
                        d='M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z'
                        stroke='#E74C3C'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M14 2V8H20'
                        stroke='#E74C3C'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M12 18V12'
                        stroke='#E74C3C'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M9 15H15'
                        stroke='#E74C3C'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </div>

                  <div style={styles.fileInfo}>
                    <div style={styles.fileName}>{files[0].name}</div>
                    <div style={styles.fileSize}>
                      {Math.round(files[0].size / 1024)} KB
                    </div>
                  </div>

                  <button
                    onClick={handleRemoveFile}
                    style={styles.removeButton}>
                    <svg
                      width='20'
                      height='20'
                      viewBox='0 0 24 24'
                      fill='none'
                      xmlns='http://www.w3.org/2000/svg'>
                      <path
                        d='M18 6L6 18'
                        stroke='#ff5252'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M6 6L18 18'
                        stroke='#ff5252'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* PDF Preview */}
            {pdfUrl && (
              <div style={styles.pdfPreviewContainer}>
                <h3 style={styles.sectionTitle}>PDF Preview</h3>
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div style={styles.pdfLoading}>
                      <div style={styles.spinner}></div>
                      <p>Loading preview...</p>
                    </div>
                  }
                  error={
                    <div style={styles.pdfError}>
                      <p>Failed to load PDF preview.</p>
                    </div>
                  }>
                  <Page
                    pageNumber={pageNumber}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={350}
                    style={styles.pdfPage}
                  />
                </Document>

                {numPages > 1 && (
                  <div style={styles.pdfPagination}>
                    <button
                      onClick={previousPage}
                      disabled={pageNumber <= 1}
                      style={{
                        ...styles.paginationButton,
                        opacity: pageNumber <= 1 ? 0.5 : 1,
                        cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
                      }}>
                      Previous
                    </button>
                    <span style={styles.pageIndicator}>
                      Page {pageNumber} of {numPages}
                    </span>
                    <button
                      onClick={nextPage}
                      disabled={pageNumber >= numPages}
                      style={{
                        ...styles.paginationButton,
                        opacity: pageNumber >= numPages ? 0.5 : 1,
                        cursor:
                          pageNumber >= numPages ? 'not-allowed' : 'pointer',
                      }}>
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Processing progress */}
            {processingPdf && (
              <div style={styles.progressContainer}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressText}>Processing PDF...</span>
                  <span style={styles.progressPercentage}>
                    {processingProgress}%
                  </span>
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${processingProgress}%`,
                    }}></div>
                </div>
              </div>
            )}

            {/* Upload progress */}
            {uploading && (
              <div style={styles.progressContainer}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressText}>Uploading images...</span>
                  <span style={styles.progressPercentage}>
                    {uploadProgress}%
                  </span>
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${uploadProgress}%`,
                    }}></div>
                </div>
              </div>
            )}

            {/* Status messages */}
            {error && (
              <div style={styles.errorMessage}>
                <svg
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                  style={{marginRight: '10px'}}>
                  <path
                    d='M12 8V12'
                    stroke='#D32F2F'
                    strokeWidth='2'
                    strokeLinecap='round'
                  />
                  <path
                    d='M12 16.01L12.01 15.9989'
                    stroke='#D32F2F'
                    strokeWidth='2'
                    strokeLinecap='round'
                  />
                  <circle
                    cx='12'
                    cy='12'
                    r='9'
                    stroke='#D32F2F'
                    strokeWidth='2'
                  />
                </svg>
                {error}
              </div>
            )}

            {uploadSuccess && (
              <div style={styles.successMessage}>
                <svg
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                  style={{marginRight: '10px'}}>
                  <path
                    d='M5 12L10 17L19 8'
                    stroke='#2E7D32'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                Upload successful! Your menu has been updated.
              </div>
            )}

            {/* Action buttons */}
            <div style={styles.actionButtons}>
              <button
                onClick={() => {
                  setFiles([]);
                  setError(null);
                  setUploadSuccess(false);
                  setPdfUrl(null);
                }}
                disabled={processingPdf || uploading || files.length === 0}
                style={{
                  ...styles.cancelButton,
                  opacity:
                    processingPdf || uploading || files.length === 0 ? 0.6 : 1,
                  cursor:
                    processingPdf || uploading || files.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                }}>
                Cancel
              </button>

              {/* Remove or comment out this block to simplify
              {imageUrls.length > 0 && (
                <button
                  onClick={handleReplaceMenu}
                  disabled={processingPdf || uploading || files.length === 0}
                  style={{
                    ...styles.replaceButton,
                    opacity:
                      processingPdf || uploading || files.length === 0
                        ? 0.6
                        : 1,
                    cursor:
                      processingPdf || uploading || files.length === 0
                        ? 'not-allowed'
                        : 'pointer',
                  }}>
                  Replace Entire Menu
                </button>
              )}
              */}

              <button
                onClick={handleUpload}
                disabled={processingPdf || uploading || files.length === 0}
                style={{
                  ...styles.uploadButton,
                  opacity:
                    processingPdf || uploading || files.length === 0 ? 0.6 : 1,
                  cursor:
                    processingPdf || uploading || files.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                }}>
                {processingPdf
                  ? 'Processing...'
                  : uploading
                  ? 'Uploading...'
                  : 'Process & Upload'}
              </button>
            </div>
          </div>
        </div>

        <div style={styles.previewSection}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Current Menu Images</h2>

            {imageUrls.length > 0 ? (
              <div style={styles.imageGrid}>
                {imageUrls.map((url, index) => (
                  <div key={index} style={styles.gridItem}>
                    <img
                      src={url}
                      alt={`Menu page ${index + 1}`}
                      style={styles.gridImage}
                    />
                    <div style={styles.pageNumber}>Page {index + 1}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.noPreview}>
                <svg
                  width='64'
                  height='64'
                  viewBox='0 0 24 24'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'>
                  <path
                    d='M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z'
                    stroke='#ccc'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z'
                    stroke='#ccc'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M21 15L16 10L5 21'
                    stroke='#ccc'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                <p style={styles.noPreviewText}>No menu images uploaded yet</p>
                <p style={styles.noPreviewSubtext}>
                  Upload a PDF to generate menu images
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help section */}
      <div style={styles.helpSection}>
        <h3 style={styles.helpTitle}>How It Works</h3>
        <ol style={styles.helpList}>
          <li style={styles.helpItem}>Upload your menu as a PDF file</li>
          <li style={styles.helpItem}>
            The system automatically converts each page to an image
          </li>
          <li style={styles.helpItem}>
            Images are uploaded to our secure cloud storage
          </li>
          <li style={styles.helpItem}>
            Your menu is instantly available via the QR code
          </li>
        </ol>
      </div>

      {/* QR Code section */}
      <div style={styles.qrSection}>
        <h3 style={styles.qrTitle}>Your Menu QR Code</h3>
        <p style={styles.qrDescription}>
          Scan this QR code to view your menu or share it with customers
        </p>
        <div style={styles.qrCodeContainer}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
              window.location.origin + '/menu',
            )}`}
            alt='Menu QR Code'
            style={styles.qrCode}
          />
          <div style={styles.qrActions}>
            <a
              href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                window.location.origin + '/menu',
              )}&download=1`}
              download='menu-qr-code.png'
              style={styles.qrDownloadButton}>
              Download QR Code
            </a>
          </div>
        </div>
      </div>

      {/* Menu History Section */}
      {menuHistory.length > 0 && (
        <div style={styles.historySection}>
          <h3 style={styles.historyTitle}>Menu History</h3>
          <div style={styles.historyList}>
            {menuHistory.map((item, index) => (
              <div key={index} style={styles.historyItem}>
                <div style={styles.historyInfo}>
                  <span style={styles.historyVersion}>
                    Version {item.version}
                  </span>
                  <span style={styles.historyDate}>
                    {new Date(
                      item.lastUpdated || item.timestamp,
                    ).toLocaleDateString()}{' '}
                    -{' '}
                    {new Date(
                      item.lastUpdated || item.timestamp,
                    ).toLocaleTimeString()}
                  </span>
                  <span style={styles.historyPages}>
                    {item.pageCount} pages
                  </span>
                </div>
                <button
                  onClick={() => restorePreviousVersion(item)}
                  style={styles.restoreButton}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Replace Entire Menu?</h3>
            <p style={styles.modalText}>
              This will replace your current menu with the new PDF. The current
              menu will be saved in history.
            </p>
            <div style={styles.modalButtons}>
              <button
                onClick={cancelReplaceMenu}
                style={styles.modalCancelButton}>
                Cancel
              </button>
              <button
                onClick={confirmReplaceMenu}
                style={styles.modalConfirmButton}>
                Replace Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: 'Arial, sans-serif',
    color: '#333',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    margin: '0 0 10px 0',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: '18px',
    color: '#7f8c8d',
    margin: 0,
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'row',
    gap: '30px',
    marginBottom: '40px',
    flexWrap: 'wrap',
  },
  uploadSection: {
    flex: '1 1 600px',
  },
  previewSection: {
    flex: '1 1 400px',
  },
  card: {
    background: 'white',
    borderRadius: '10px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    padding: '30px',
    height: '100%',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '20px',
    color: '#2c3e50',
  },
  uploadArea: {
    border: '2px dashed #ccc',
    borderRadius: '8px',
    padding: '40px 20px',
    textAlign: 'center',
    marginBottom: '30px',
    background: '#f9f9f9',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  uploadIcon: {
    marginBottom: '15px',
  },
  uploadText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '15px',
  },
  browseButton: {
    display: 'inline-block',
    padding: '12px 24px',
    background: '#4A90E2',
    color: 'white',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background 0.3s ease',
  },
  supportedFormats: {
    fontSize: '13px',
    color: '#999',
    marginTop: '15px',
  },
  selectedFiles: {
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '15px',
    color: '#333',
    fontWeight: '600',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px',
    border: '1px solid #eee',
    borderRadius: '8px',
    background: '#f9f9f9',
  },
  fileIcon: {
    width: '24px',
    height: '24px',
    marginRight: '15px',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontWeight: '500',
    marginBottom: '3px',
    color: '#333',
    wordBreak: 'break-all',
  },
  fileSize: {
    fontSize: '13px',
    color: '#888',
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#ff5252',
    cursor: 'pointer',
    padding: '5px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPreviewContainer: {
    marginBottom: '20px',
  },
  pdfPage: {
    margin: '0 auto',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    borderRadius: '4px',
  },
  pdfLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(0, 0, 0, 0.1)',
    borderTop: '4px solid #4A90E2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  pdfError: {
    padding: '12px',
    background: '#FFEBEE',
    color: '#D32F2F',
    borderRadius: '5px',
    marginBottom: '20px',
  },
  pdfPagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '10px',
    gap: '10px',
  },
  paginationButton: {
    padding: '5px 10px',
    background: '#f1f1f1',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  pageIndicator: {
    fontSize: '14px',
    color: '#666',
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '15px',
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '10px',
  },
  gridItem: {
    position: 'relative',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
  },
  gridImage: {
    width: '100%',
    aspectRatio: '3/4',
    objectFit: 'cover',
    display: 'block',
  },
  pageNumber: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    background: 'rgba(0,0,0,0.6)',
    color: 'white',
    padding: '5px',
    fontSize: '12px',
    textAlign: 'center',
  },
  noPreview: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    background: '#f9f9f9',
    borderRadius: '8px',
    border: '1px dashed #ddd',
  },
  noPreviewText: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#666',
    margin: '15px 0 5px',
  },
  noPreviewSubtext: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  helpSection: {
    background: 'white',
    borderRadius: '10px',
    padding: '25px 30px',
    marginBottom: '40px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
  helpTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '15px',
    color: '#2c3e50',
  },
  helpList: {
    paddingLeft: '20px',
    margin: 0,
  },
  helpItem: {
    marginBottom: '10px',
    color: '#666',
    lineHeight: '1.5',
  },
  qrSection: {
    background: 'white',
    borderRadius: '10px',
    padding: '30px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  },
  qrTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '10px',
    color: '#2c3e50',
  },
  qrDescription: {
    color: '#666',
    marginBottom: '20px',
  },
  qrCodeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  qrCode: {
    width: '200px',
    height: '200px',
    marginBottom: '20px',
    border: '1px solid #eee',
    padding: '10px',
    borderRadius: '8px',
    background: 'white',
  },
  qrActions: {
    marginTop: '10px',
  },
  qrDownloadButton: {
    display: 'inline-block',
    padding: '10px 20px',
    background: '#4A90E2',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '5px',
    fontWeight: '500',
    transition: 'background 0.3s ease',
  },
  progressContainer: {
    marginBottom: '20px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  progressText: {
    fontSize: '14px',
    color: '#666',
  },
  progressPercentage: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500',
  },
  progressBar: {
    height: '8px',
    background: '#eee',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#4CAF50',
    transition: 'width 0.3s ease',
  },
  errorMessage: {
    padding: '12px 15px',
    background: '#FFEBEE',
    color: '#D32F2F',
    borderRadius: '5px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  successMessage: {
    padding: '12px 15px',
    background: '#E8F5E9',
    color: '#2E7D32',
    borderRadius: '5px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
  },
  cancelButton: {
    padding: '12px 20px',
    background: 'white',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontWeight: '500',
  },
  uploadButton: {
    padding: '12px 25px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
  },
  replaceButton: {
    padding: '12px 20px',
    background: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
  },
  historySection: {
    background: 'white',
    borderRadius: '10px',
    padding: '25px 30px',
    marginBottom: '40px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
  historyTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '15px',
    color: '#2c3e50',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #eee',
    background: '#f9f9f9',
  },
  historyInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  historyVersion: {
    fontWeight: '600',
    color: '#333',
  },
  historyDate: {
    fontSize: '14px',
    color: '#666',
  },
  historyPages: {
    fontSize: '14px',
    color: '#666',
  },
  restoreButton: {
    padding: '8px 15px',
    background: '#4A90E2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'white',
    borderRadius: '10px',
    padding: '30px',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '15px',
    color: '#2c3e50',
  },
  modalText: {
    marginBottom: '20px',
    color: '#666',
    lineHeight: '1.5',
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
  },
  modalCancelButton: {
    padding: '10px 15px',
    background: 'white',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  modalConfirmButton: {
    padding: '10px 15px',
    background: '#ff5252',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
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

export default AdminPage;
