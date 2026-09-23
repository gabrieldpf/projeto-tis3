/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Otimiza imports de ícones do MUI (só o que é usado entra no bundle).
  modularizeImports: {
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}',
    },
  },
}

export default nextConfig
