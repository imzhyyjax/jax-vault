type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm";

  const variants = {
    primary:
      "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 hover:shadow-lg hover:shadow-purple-500/50 disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:scale-100",
    secondary:
      "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 hover:from-gray-200 hover:to-gray-300 hover:shadow-md disabled:bg-gray-100 disabled:text-gray-400 disabled:scale-100",
    ghost:
      "bg-transparent text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 active:bg-gray-200 disabled:text-gray-400 disabled:scale-100 shadow-none",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

