import { withBasePath } from "@/src/lib/base-path";

type Props = {
  size?: number;
  priority?: boolean;
  className?: string;
};

export function ExitoMark({ size = 32, priority = false, className = "" }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- basePath do HUB quebra o optimizer do next/image
    <img
      src={withBasePath("/exito-logo.png")}
      alt=""
      aria-hidden
      width={size}
      height={size}
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
