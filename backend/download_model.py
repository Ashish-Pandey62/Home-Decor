import os
import sys
import urllib.request
from pathlib import Path

def download_sam_model():
    """Download the SAM model weights if they don't exist."""
    # Create models directory if it doesn't exist
    models_dir = Path(__file__).parent.parent / "models"
    models_dir.mkdir(exist_ok=True)
    
    model_path = models_dir / "sam_vit_h_4b8939.pth"
    if model_path.exists():
        print("Model weights already exist.")
        return
    
    url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
    print(f"Downloading SAM model weights from {url}")
    
    try:
        def report_progress(count, block_size, total_size):
            percent = int(count * block_size * 100 / total_size)
            sys.stdout.write(f"\rDownloading: {percent}%")
            sys.stdout.flush()
        
        urllib.request.urlretrieve(url, model_path, reporthook=report_progress)
        print("\nDownload completed successfully!")
    except Exception as e:
        print(f"\nError downloading model weights: {e}")
        if model_path.exists():
            os.remove(model_path)
        sys.exit(1)

if __name__ == "__main__":
    download_sam_model()