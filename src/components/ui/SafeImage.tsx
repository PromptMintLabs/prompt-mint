import { useState } from "react";
import { cn } from "@/lib/utils";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  proxy?: boolean;
}

export function SafeImage({
  src,
  alt,
  fallbackSrc = "/images/codeguru.png",
  className,
  proxy = true,
  ...props
}: SafeImageProps) {
  const [error, setError] = useState(false);

  // Use wsrv.nl proxy to optimize remote images and enforce sizes/format
  // Avoid proxying local assets or relative paths
  const isRemote = src && (src.startsWith("http://") || src.startsWith("https://"));
  
  const currentSrc = src || fallbackSrc;
  
  const finalSrc =
    error || !src
      ? fallbackSrc
      : proxy && isRemote
        ? `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=webp&w=800`
        : currentSrc;

  const srcSet =
    proxy && isRemote && !error && src
      ? `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=webp&w=400 400w, https://wsrv.nl/?url=${encodeURIComponent(src)}&output=webp&w=800 800w, https://wsrv.nl/?url=${encodeURIComponent(src)}&output=webp&w=1200 1200w`
      : undefined;

  const sizes = proxy && isRemote && !error && src ? "(max-width: 768px) 400px, (max-width: 1200px) 800px, 1200px" : undefined;

  return (
    <img
      src={finalSrc}
      alt={alt}
      srcSet={srcSet}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      className={cn("bg-slate-900 object-cover", className)}
      onError={() => setError(true)}
      {...props}
    />
  );
}
