import cloudinary
import cloudinary.uploader

from app.core.config import settings


cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_profile_photo(file):
    result = cloudinary.uploader.upload(
        file,
        folder="hrms/profile_photos",
        resource_type="image",
    )

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }


def delete_profile_photo(public_id: str):
    return cloudinary.uploader.destroy(
        public_id,
        resource_type="image",
    )