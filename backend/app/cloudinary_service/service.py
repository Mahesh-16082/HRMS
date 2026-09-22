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


def upload_work_report_attachment(file, report_id: int, original_filename: str, resource_type: str = "auto"):
    """
    Upload a document attachment for a work report to Cloudinary.
    Uses 'auto' or 'raw'/'image' resource_type so PDF, Word, Excel, PowerPoint, Text, and Images are properly handled.
    """
    result = cloudinary.uploader.upload(
        file,
        folder=f"hrms/work_reports/{report_id}",
        resource_type=resource_type,
        use_filename=True,
        filename_override=original_filename,
    )

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }


def delete_work_report_attachment(public_id: str, resource_type: str = "raw"):
    """
    Delete a work report attachment from Cloudinary.
    """
    return cloudinary.uploader.destroy(
        public_id,
        resource_type=resource_type,
    )