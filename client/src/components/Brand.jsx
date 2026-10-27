import React from 'react';

/**
 * Reusable Brand component for VINO FITNESS STUDIO.
 * Provides unified, responsive brand identity across the entire application.
 *
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg' | 'xl' | 'compact'} [props.size='md'] - Visual scale
 * @param {string} [props.subtitle='UNISEX FITNESS STUDIO'] - Brand tagline or badge text
 * @param {boolean} [props.showLogo=true] - Whether to show the crest logo
 * @param {boolean} [props.showText=true] - Whether to show typography
 * @param {boolean} [props.showSub=true] - Whether to show the subtitle
 * @param {Function} [props.onClick] - Click handler
 * @param {string} [props.className=''] - Additional custom CSS classes
 * @param {'button' | 'div' | 'a'} [props.as='button'] - Wrapper element tag
 * @param {string} [props.href] - Href if rendered as anchor
 */
export function Brand({
  size = 'md',
  subtitle = 'UNISEX FITNESS STUDIO',
  showLogo = true,
  showText = true,
  showSub = true,
  onClick,
  className = '',
  as: Component = onClick ? 'button' : 'div',
  ...rest
}) {
  const sizeClass = size ? `brand-${size}` : '';
  const combinedClass = `brand ${sizeClass} ${className}`.trim();

  return (
    <Component
      className={combinedClass}
      onClick={onClick}
      type={Component === 'button' ? 'button' : undefined}
      aria-label="Vino Fitness Studio"
      {...rest}
    >
      {showLogo && (
        <span className="brand-logo-frame">
          <img
            src="/Gym-Logo-128.png"
            srcSet="/Gym-Logo-128.png 1x, /Gym-Logo-512.png 2x"
            alt="Vino Fitness Studio Crest Logo"
            className="brand-logo-img"
            loading="eager"
            decoding="async"
          />
        </span>
      )}
      {showText && (
        <span className="brand-copy">
          <span className="brand-title">
            VINO <span className="brand-highlight">FITNESS STUDIO</span>
          </span>
          {showSub && subtitle && (
            <small className="brand-subtitle">{subtitle}</small>
          )}
        </span>
      )}
    </Component>
  );
}

export default Brand;
