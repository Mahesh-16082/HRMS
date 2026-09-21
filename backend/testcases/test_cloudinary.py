import cloudinary
import cloudinary.api

from app.core.config import settings


cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

try:
    result = cloudinary.api.ping()
    print("Cloudinary connection successful!")
    print(result)

except Exception as e:
    print("Cloudinary connection failed!")
    print(f"Error: {e}")