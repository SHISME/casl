import babel from 'rollup-plugin-babel';
import url from '@rollup/plugin-url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import html from '@rollup/plugin-html';
import { terser } from 'rollup-plugin-terser';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import replace from 'rollup-plugin-replace';
import copy from 'rollup-plugin-copy';
import { content, summary } from 'rollup-plugin-content';
import { legacyBundle } from 'rollup-plugin-legacy-bundle';
import xyaml from 'xyaml-webpack-loader/rollup';
import { generateSW } from 'rollup-plugin-workbox';
import indexHTML from './tools/index.html';
import { parsexYaml, parseFrontMatter, markdownOptions } from './tools/contentParser';
import { SearchIndex } from './tools/SearchIndex';

const env = (name, plugins) => process.env.NODE_ENV === name ? plugins : [];
const SUPPORTED_LANGS = ['en'];
const minify = terser({
  mangle: {
    properties: {
      reserved: [
        '_classProperties'
      ],
      regex: /^_/
    }
  }
});

const DEST = '../docs';
const PUBLIC_PATH = '/';
const GA_ID = 'UA-19088556-6';

export default {
  input: 'src/bootstrap.js',
  output: {
    format: 'es',
    dir: DEST,
    sourcemap: true,
    assetFileNames: process.env.NODE_ENV === 'production'
      ? 'assets/[name].[hash].[ext]'
      : 'assets/[name].[ext]',
    entryFileNames: process.env.NODE_ENV === 'production'
      ? '[name].[hash].js'
      : '[name].js',
    plugins: [
      ...env('production', [
        minify,
      ]),
    ]
  },
  plugins: [
    ...env('production', [
      minifyHTML(),
      legacyBundle({
        format: 'iife',
        polyfills: [
          'core-js/modules/es.array.find',
          'core-js/modules/es.array.from',
          'core-js/modules/es.array.includes',
          'core-js/modules/es.object.assign',
          'core-js/modules/es.object.entries',
          'core-js/modules/es.promise',
          'core-js/modules/es.string.includes',
          'core-js/modules/es.string.starts-with',
          'core-js/modules/es.string.ends-with',
          'core-js/modules/es.weak-set',
          'core-js/modules/es.reflect.construct',
          'ie11-custom-properties',
          'regenerator-runtime/runtime',
        ],
        plugins: [
          resolve(),
          commonjs(),
          babel({
            rootMode: 'upward',
            inputSourceMap: true,
            exclude: [
              'node_modules/core-js/**/*.js',
              'node_modules/regenerator-runtime/runtime.js'
            ],
            caller: {
              output: 'es5'
            },
          }),
          minify,
          copy({
            verbose: true,
            targets: [
              { src: 'node_modules/@webcomponents/webcomponentsjs', dest: `${DEST}/legacy/` }
            ]
          }),
        ]
      }),
    ]),
    url({ publicPath: PUBLIC_PATH }),
    resolve(),
    babel({
      rootMode: 'upward',
      include: [
        'src/**/*.js',
        'node_modules/lit-element/**/*.js'
      ],
      caller: {
        output: 'es'
      },
    }),
    commonjs(),
    xyaml({
      markdown: markdownOptions,
      esm: true,
      namedExports: false,
    }),
    copy({
      copyOnce: true,
      flatten: false,
      targets: [
        { src: 'public/**/*', dest: DEST },
      ]
    }),
    copy({
      targets: [
        { src: 'src/content/**/*.{png,jpeg,svg}', dest: `${DEST}/images` }
      ]
    }),
    content({
      entry: /\.i18n$/,
      langs: SUPPORTED_LANGS,
      summarizer: false,
      pageSchema: false,
      parse: parsexYaml,
    }),
    content({
      entry: /\.pages$/,
      files: '**/*.md',
      langs: SUPPORTED_LANGS,
      pageSchema: false,
      parse: parseFrontMatter,
      plugins: [
        summary({
          fields: ['id', 'title', 'categories', 'headings'],
          sortBy: ['order'],
          indexBy: ['id'],
        }),
        summary(SearchIndex.factory()),
      ]
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.APP_LANGS': JSON.stringify(SUPPORTED_LANGS),
      'process.env.APP_REPO_URL': JSON.stringify('https://github.com/stalniy/casl'),
      'process.env.APP_BASE_URL': JSON.stringify(PUBLIC_PATH.replace(/\/$/, '')),
    }),
    html({
      title: 'CASL',
      publicPath: PUBLIC_PATH,
      template: indexHTML({
        analyticsId: process.env.NODE_ENV === 'production' ? GA_ID : null,
      }),
      attributes: {
        html: null,
        link: null,
        script: null,
      },
    }),
    generateSW({
      swDest: `${DEST}/sw.js`,
      cleanupOutdatedCaches: true,
      inlineWorkboxRuntime: process.env.NODE_ENV === 'production',
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      globDirectory: DEST,
      globPatterns: [
        'assets/*.json',
        'app-icons/*',
        'manifest.json',
        'index.html',
        '*.js'
      ]
    })
  ]
};
