/**
 * Responsive Style Helpers
 * Mixins and utilities for responsive design
 */

/**
 * Get responsive container styles
 * - Max width on desktop
 * - Full width on mobile with padding
 */
export const responsiveContainerStyle = {
  padding: "20px",
  maxWidth: "1200px",
  margin: "0 auto",
  boxSizing: "border-box",
};

/**
 * Get responsive form styles
 * - Full width inputs
 * - Proper spacing for touch
 */
export const responsiveFormStyle = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "20px",
};

/**
 * Get responsive grid styles
 * - Flex wrap for mobile
 * - Min width for cards
 */
export const responsiveGridStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "15px",
  justifyContent: "center",
};

/**
 * Get responsive button styles
 * - Full width on mobile
 * - Proper padding for touch
 */
export const responsiveButtonStyle = {
  padding: "12px 16px",
  width: "100%",
  maxWidth: "300px",
  border: "none",
  borderRadius: "4px",
  fontSize: "16px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "opacity 0.2s",
};

/**
 * Get responsive input styles
 * - Full width
 * - Larger touch targets
 */
export const responsiveInputStyle = {
  width: "100%",
  padding: "12px",
  fontSize: "16px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

/**
 * Media query helper for responsive text
 */
export const responsiveHeadingStyle = (mobileSize = 24, desktopSize = 32) => ({
  fontSize: `clamp(${mobileSize}px, 5vw, ${desktopSize}px)`,
  margin: "0 0 20px 0",
});

/**
 * Media query helper for responsive padding
 */
export const responsivePaddingStyle = {
  padding: "clamp(15px, 5vw, 40px)",
};
