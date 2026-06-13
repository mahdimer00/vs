import { ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useApp } from "@/hooks/useApp";
import { adminService } from "@/services/admin.service";
import { ApiError } from "@/services/apiClient";
import { translate } from "@/utils/i18n";

export function ImageUploadField({
  token,
  value,
  onChange,
  placeholder,
}: {
  token: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const { language, pushToast } = useApp();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const result = await adminService.uploadImage(token, file);
      onChange(result.url);
      pushToast(translate(language, "adminImageUploadSuccess"), "success");
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminImageUploadError"), "error");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field-input flex-1"
          placeholder={placeholder ?? translate(language, "adminImageUrl")}
        />
        <label className="ghost-button cursor-pointer whitespace-nowrap">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <span className="ms-2">{translate(language, "adminUploadImage")}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
        </label>
      </div>
      {value ? <img src={value} alt="" className="h-20 w-20 rounded-xl object-cover" /> : null}
    </div>
  );
}
