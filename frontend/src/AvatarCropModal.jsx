import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedCircularBlob } from "./avatarCrop";

export default function AvatarCropModal({ imageSrc, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedCircularBlob(imageSrc, croppedAreaPixels);
      await onConfirm(blob);
    } catch (err) {
      alert(err.message || "Não foi possível recortar a imagem.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="avatar-crop-overlay" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
      <div className="avatar-crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-crop-header">
          <h3 id="avatar-crop-title">Recortar foto de perfil</h3>
          <p>Ajuste o zoom e posicione o rosto ou ícone no círculo.</p>
        </div>

        <div className="avatar-crop-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="avatar-crop-zoom">
          <span className="material-symbols-rounded">zoom_out</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom do recorte"
          />
          <span className="material-symbols-rounded">zoom_in</span>
        </div>

        <div className="avatar-crop-actions">
          <button type="button" className="btn-crop-cancel" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn-crop-confirm" onClick={handleConfirm} disabled={saving}>
            {saving ? "Salvando..." : "Usar esta foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
