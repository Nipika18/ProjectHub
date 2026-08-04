import os
import shutil
from typing import Optional
from fastapi import UploadFile
from backend.app.core.config import settings

class FileStorageService:
    def __init__(self):
        # Determine if we should use AWS S3 Storage based on environmental availability
        self.use_s3 = bool(
            settings.AWS_ACCESS_KEY_ID and 
            settings.AWS_SECRET_ACCESS_KEY and 
            settings.AWS_S3_BUCKET_NAME
        )
        
        if self.use_s3:
            print("[Sprint AI] AWS credentials detected. Enabling AWS S3 Cloud Storage mode.")
            import boto3
            from botocore.config import Config
            self.bucket_name = settings.AWS_S3_BUCKET_NAME
            
            # We explicitly define the endpoint_url here. If we don't, boto3 uses the global 
            # s3.amazonaws.com endpoint. For buckets outside us-east-1 (like eu-north-1), 
            # AWS issues a redirect which breaks the cryptographic signature of the presigned URL!
            regional_endpoint = f"https://s3.{settings.AWS_REGION}.amazonaws.com"
            
            # Configure boto3 client
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
                endpoint_url=regional_endpoint,
                config=Config(signature_version='s3v4')
            )
            self.bucket_name = settings.AWS_S3_BUCKET_NAME
        else:
            print("[Sprint AI] AWS credentials missing. Falling back to Local Storage mode.")
            # Ensure local uploads directory exists
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    def get_file_path(self, filename: str, file_hash: str, project_id: Optional[int] = None) -> str:
        unique_prefix = file_hash[:16]  # Use first 16 chars of the hash
        
        # Sanitize filename to prevent Path Traversal
        safe_filename = os.path.basename(filename)
        
        # Use a slash to create a folder structure in S3/Local
        prefix = f"documents/proj_{project_id}/" if project_id is not None else "documents/"
        clean_filename = f"{prefix}{unique_prefix}_{safe_filename}"
        
        if self.use_s3:
            return clean_filename
        else:
            return os.path.join(settings.UPLOAD_DIR, clean_filename)

    def save_file(self, upload_file: UploadFile, project_id: Optional[int] = None) -> str:
        """
        Saves an uploaded file using a content hash to prevent duplicate storage.
        - In S3 Mode: Uploads to AWS S3 bucket. Returns the unique filename.
        - In Local Mode: Saves to disk. Returns the absolute disk path.
        """
        import hashlib
        import tempfile
        
        # Generate hash using chunks to prevent OOM
        sha256_hash = hashlib.sha256()
        
        # Write to a temporary file while hashing to avoid keeping it in RAM
        fd, temp_path = tempfile.mkstemp()
        with os.fdopen(fd, 'wb') as f:
            while chunk := upload_file.file.read(8192):
                sha256_hash.update(chunk)
                f.write(chunk)
                
        file_hash = sha256_hash.hexdigest()
        file_path = self.get_file_path(upload_file.filename, file_hash, project_id)

        try:
            if self.use_s3:
                content_type = upload_file.content_type or "application/octet-stream"
                
                try:
                    with open(temp_path, "rb") as f:
                        self.s3_client.upload_fileobj(
                            f, 
                            self.bucket_name, 
                            file_path,
                            ExtraArgs={"ContentType": content_type}
                        )
                except Exception as e:
                    print(f"AWS S3 upload error: {str(e)}")
                    raise e
                return file_path
            else:
                # Ensure the directory exists (since file_path might now contain subfolders)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                shutil.move(temp_path, file_path)
                return file_path
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass

    def delete_file(self, file_path: str) -> bool:
        """
        Purges a document from S3 bucket or local disk.
        """
        try:
            if self.use_s3:
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=file_path)
                return True
            else:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    return True
        except Exception as e:
            print(f"Error purging file at {file_path}: {str(e)}")
            return False
        return False

    def delete_project_folder(self, project_id: int) -> bool:
        """
        Purges an entire project folder (proj_X/) from S3 bucket or local disk.
        Called when a project is deleted to ensure zero orphan storage folders remain.
        """
        folder_prefix = f"proj_{project_id}/"
        try:
            if self.use_s3:
                # List all files in the project folder and delete them in batch
                paginator = self.s3_client.get_paginator('list_objects_v2')
                pages = paginator.paginate(Bucket=self.bucket_name, Prefix=folder_prefix)
                
                delete_us = dict(Objects=[])
                for item in pages.search('Contents'):
                    if item:
                        delete_us['Objects'].append(dict(Key=item['Key']))
                
                if delete_us['Objects']:
                    self.s3_client.delete_objects(Bucket=self.bucket_name, Delete=delete_us)
                
                print(f"[Sprint AI] Purged AWS S3 Storage folder: {folder_prefix}")
                return True
            else:
                folder_path = os.path.join(settings.UPLOAD_DIR, f"proj_{project_id}")
                if os.path.isdir(folder_path):
                    shutil.rmtree(folder_path)
                    print(f"[Sprint AI] Purged local storage folder: {folder_path}")
                return True
        except Exception as e:
            print(f"[Sprint AI] Error purging project folder {folder_prefix}: {str(e)}")
            return False

    def cleanup_orphan_folders(self, existing_project_ids: set) -> int:
        """
        Directly inspects storage folders (proj_X) and purges any folder whose ID X
        is not in existing_project_ids.
        """
        purged_count = 0
        try:
            if self.use_s3:
                # S3 doesn't have true folders, but we can list common prefixes using a delimiter
                result = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Delimiter='/')
                prefixes = [p.get('Prefix') for p in result.get('CommonPrefixes', [])]
                
                for prefix in prefixes:
                    if prefix.startswith("proj_"):
                        try:
                            # prefix looks like "proj_123/"
                            pid_str = prefix.split("proj_")[1].strip("/")
                            pid = int(pid_str)
                            if pid not in existing_project_ids:
                                self.delete_project_folder(pid)
                                purged_count += 1
                        except ValueError:
                            pass
            else:
                if os.path.exists(settings.UPLOAD_DIR):
                    for entry in os.listdir(settings.UPLOAD_DIR):
                        if entry.startswith("proj_") and os.path.isdir(os.path.join(settings.UPLOAD_DIR, entry)):
                            try:
                                pid = int(entry.split("proj_")[1])
                                if pid not in existing_project_ids:
                                    shutil.rmtree(os.path.join(settings.UPLOAD_DIR, entry))
                                    purged_count += 1
                            except ValueError:
                                pass
        except Exception as e:
            print(f"[Sprint AI] Error scanning orphan storage folders: {str(e)}")
        return purged_count

    def get_local_path(self, file_path: str) -> str:
        """
        Retrieves a physical local path to parse document contents.
        - In Local Mode: returns the file_path itself.
        - In S3 Mode: downloads the file to a temporary file on disk and returns the temp path.
          (The caller is responsible for deleting the temp file after parsing it).
        """
        if not self.use_s3:
            return file_path

        # Generate a temporary path in our uploads directory
        safe_file_path = file_path.replace("/", "_").replace("\\", "_")
        temp_filename = f"temp_{safe_file_path}"
        temp_path = os.path.join(settings.UPLOAD_DIR, temp_filename)
        
        # Ensure upload folder is created
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

        try:
            # Download file
            self.s3_client.download_file(self.bucket_name, file_path, temp_path)
            return temp_path
        except Exception as e:
            print(f"Error downloading file {file_path} from AWS S3: {str(e)}")
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
            raise e

storage_service = FileStorageService()
