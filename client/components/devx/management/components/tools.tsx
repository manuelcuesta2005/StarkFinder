import React from "react";

type ContractEditor = {
  code: string,
  setCode: (code: string) => void
}

type TomlViewer = {
  toml: string,
  setToml: (toml: string) => void
}

type Output = {
  output: string
}

export const ContractEditor: React.FC<ContractEditor> = ({ code, setCode }) => {
  return (
    <div className="bg-neutral-900 p-4 rounded-2xl shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-2">Cairo Contract</h2>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
        className="w-full font-mono text-sm bg-black text-green-400 border border-green-600 rounded-xl p-3 resize-y outline-none focus:ring-2 focus:ring-green-500"
        placeholder="Paste your cairo contract here..."
      />
    </div>
  );
};

export const TomlViewer: React.FC<TomlViewer> = ({ toml, setToml }) => {
  return (
    <div className="bg-neutral-900 p-4 rounded-2xl shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-2">Toml Generated</h2>
      <textarea
        value={toml}
        onChange={(e) => setToml(e.target.value)}
        rows={10}
        className="w-full font-mono text-sm bg-gray-950 text-yellow-300 border border-yellow-600 rounded-xl p-3 resize-y outline-none focus:ring-2 focus:ring-yellow-400"
      />
    </div>
  );
};

export const TerminalOutput: React.FC<Output> = ({output}) => {
  return (
    <div className="bg-neutral-900 p-4 rounded-2xl shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-2">🖥️ Build Output</h2>
      <pre className="w-full font-mono text-sm bg-black text-white border border-gray-700 rounded-xl p-3 overflow-auto max-h-64">
        {output || "Aún no se ha compilado"}
      </pre>
    </div>
  );
};
