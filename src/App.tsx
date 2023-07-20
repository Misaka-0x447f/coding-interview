import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Portal from './portal';
import {ConfigProvider} from "antd";

function App() {
  return (
      <ConfigProvider autoInsertSpaceInButton={false}>
          <BrowserRouter>
              <Routes>
                  <Route path="/" element={<Portal />} />
              </Routes>
          </BrowserRouter>
      </ConfigProvider>
  );
}

export default App;
