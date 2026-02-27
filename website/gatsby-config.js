module.exports = {
  pathPrefix: '/opencastle',
  siteMetadata: {
    title: 'OpenCastle',
    description:
      'Open-source multi-agent orchestration framework for AI coding assistants. Turn GitHub Copilot, Cursor, and Claude Code into coordinated development teams.',
    siteUrl: 'https://etylsarin.github.io/opencastle',
    author: 'Filip Mares',
  },
  plugins: [
    'gatsby-plugin-image',
    'gatsby-plugin-sharp',
    'gatsby-transformer-sharp',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'images',
        path: `${__dirname}/src/images`,
      },
    },
  ],
};
