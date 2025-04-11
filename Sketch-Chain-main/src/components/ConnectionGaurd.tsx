import { useAccount } from 'wagmi';
import { useRouter } from 'next/router';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface ConnectionGuardProps {
  children: React.ReactNode;
}

export const ConnectionGuard = ({ children }: ConnectionGuardProps) => {
  const { address } = useAccount();
  const router = useRouter();
  const publicPaths = ['/', '/connect'];

  if (!address && !publicPaths.includes(router.pathname)) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="w-full max-w-md p-6 md:p-8 bg-white rounded-xl shadow-xl border border-gray-100 text-center transform transition-all duration-300 hover:shadow-2xl">
          <h2 className="text-xl md:text-2xl font-bold mb-3 text-gray-800">Wallet Connection Required</h2>
          <p className="text-gray-600 mb-6 text-sm md:text-base">Please connect your wallet to continue</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};




// import { useAccount } from 'wagmi';
// import { useRouter } from 'next/router';
// import { ConnectButton } from '@rainbow-me/rainbowkit';

// interface ConnectionGuardProps {
//   children: React.ReactNode;
// }

// export const ConnectionGuard = ({ children }: ConnectionGuardProps) => {
//   const { address } = useAccount();
//   const router = useRouter();
//   const publicPaths = ['/', '/connect'];

//   if (!address && !publicPaths.includes(router.pathname)) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50">
//         <div className="p-8 bg-white rounded-lg shadow-lg text-center">
//           <h2 className="text-2xl font-bold mb-4">Wallet Connection Required</h2>
//           <p className="text-gray-600 mb-4">Please connect your wallet to continue</p>
//           <ConnectButton />
//         </div>
//       </div>
//     );
//   }

//   return <>{children}</>;
// };