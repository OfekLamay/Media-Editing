import { useState } from 'react';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a video file first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      const response = await fetch('http://localhost:3003/api/video/boomerang', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error processing the video on the server.');
      }

      const blob = await response.blob();
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `edited_boomerang_${Date.now()}.mp4`; 
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      console.error(err);
      setError('Something went wrong while processing the video. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Media Editor</h1>
      <p>Upload a video file to create a boomerang effect!</p>

      <div className="upload-container">
        <input 
          type="file" 
          accept="video/mp4,video/quicktime" 
          onChange={handleFileChange} 
          disabled={isLoading}
        />
        <button 
          onClick={handleUpload} 
          disabled={!selectedFile || isLoading}
        >
          {isLoading ? 'Processing...' : 'Create Boomerang'}
        </button>
      </div>

      {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default App;