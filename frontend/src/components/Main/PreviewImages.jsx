import React from "react";
/**
 * Props:
 * - isOpen: boolean → whether the dialog is visible
 * - onClose: function → callback to close dialog
 * - images: array of image URLs → images to display
 */
function PreviewImages({ isOpen, onClose, images = [] }) {
    if (!isOpen) return null; // Don't render if closed

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
            onClick={onClose} // Click outside closes modal
        >
            <div
                className="relative bg-white rounded-lg shadow-lg w-11/12 md:w-3/4 lg:w-1/2 p-6 h-[400px] overflow-y-auto"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                {/* Header */}
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Image Preview</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-600 hover:text-gray-900 text-2xl leading-none"
                    >
                        &times;
                    </button>
                </div>

                {/* Images Grid */}
                {images.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {images.map((src, index) => (
                            <div
                                key={index}
                                className="relative rounded-md overflow-hidden border border-gray-200 shadow-sm"
                            >
                                <img
                                    src={src}
                                    alt={`Preview ${index}`}
                                    className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-6">
                        No images available to preview.
                    </p>
                )}
            </div>
        </div>
    );
}

export default PreviewImages;
