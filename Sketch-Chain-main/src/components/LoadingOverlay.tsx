import { LoadingSpinner } from "./LoadingSpinner";

interface LoadingOverlayProps {
    message?: string;
  }
  
  export const LoadingOverlay = ({ message = 'Loading...' }: LoadingOverlayProps) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <LoadingSpinner />
        <p className="mt-2 text-gray-600">{message}</p>
      </div>
    </div>
  );