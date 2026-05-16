import React from 'react';
import { renderToString } from 'react-dom/server';
import { Streamdown } from 'streamdown';

console.log(renderToString(<Streamdown>Hello World!</Streamdown>));
