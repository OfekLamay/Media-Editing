import { useState } from 'react';
import './App.css';

type ActionType = 'boomerang' | 'remove-audio' | 'reverse' | 'concat' | 'improve';

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [action, setAction] = useState<ActionType>('boomerang');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one video file to proceed.');
      return;
    }

    if (action === 'concat' && selectedFiles.length < 2) {
      setError('For concatenating videos, you must select at least 2 files.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    
    if (action === 'concat') {
      selectedFiles.forEach(file => formData.append('videos', file));
    } else {
      formData.append('video', selectedFiles[0]); 
    }

    try {
      const response = await fetch(`http://localhost:3003/api/video/${action}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error editing the video on the server.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `edited_${action}_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      setError('Something went wrong during editing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎬 Video Studio Pro</h1>
        <p>Select an action, upload a video, and let the server do the magic.</p>
      </header>

      <div className="editor-card">
        <div className="action-selector">
          <h3>What would you like to do?</h3>
          <div className="button-group">
            <button className={action === 'boomerang' ? 'active' : ''} onClick={() => setAction('boomerang')}>🔄 Boomerang</button>
            <button className={action === 'reverse' ? 'active' : ''} onClick={() => setAction('reverse')}>⏪ Reverse</button>
            <button className={action === 'remove-audio' ? 'active' : ''} onClick={() => setAction('remove-audio')}>🔇 Remove Audio</button>
            <button className={action === 'concat' ? 'active' : ''} onClick={() => setAction('concat')}>🔗 Concatenate Videos</button>
            <button className={action === 'improve' ? 'active' : ''} onClick={() => setAction('improve')}>✨ Improve Quality</button>
          </div>
        </div>

        <div className="upload-section">
          <label className="file-label">
            {action === 'concat' ? 'Select videos to concatenate (min 2)' : 'Select a video file'}
            <input 
              type="file" 
              accept="video/mp4,video/quicktime" 
              multiple={action === 'concat'} 
              onChange={handleFileChange} 
              disabled={isLoading}
            />
          </label>
          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <p>{selectedFiles.length} files selected.</p>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          className="submit-btn" 
          onClick={handleUpload} 
          disabled={selectedFiles.length === 0 || isLoading}
        >
          {isLoading ? <span className="spinner">⏳ Processing...</span> : 'Start Editing 🚀'}
        </button>
      </div>
    </div>
  );
}

export default App;