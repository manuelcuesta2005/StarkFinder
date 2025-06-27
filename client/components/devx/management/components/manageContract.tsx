/* eslint-disable react-hooks/rules-of-hooks */
import { useState } from "react";
import { ContractEditor, TomlViewer, TerminalOutput } from "./tools";
import { extractImports, generateScarb } from "../extractImports";

export const ManageContract = () => {
    const [ contractCode, setContractCode ] = useState("")
    const [ scarbToml, setScarbToml ] = useState("")
    const [ output, setOutput ] = useState("")

    const handleGenerateScarb = () => {
        const dependencies = extractImports(contractCode)
        const toml = generateScarb(dependencies)
        setScarbToml(toml)
    }

    const handleCompile = async () => {
        try {
            const res = await fetch('/api/compile/', {
                method: 'POST',
                headers: { "Content-type": "application/json" },
                body: JSON.stringify({ contract: contractCode, scarbToml }),
            })
            const data = await res.text();
            setOutput(data)
        } catch (error) {
            setOutput(`Compilation error: ${String(error)}`)
        }
    }
    return (
        <div className="grid grid-cols-1 gap-4 p-4">
            <ContractEditor code={contractCode} setCode={setContractCode} />
            <button onClick={handleGenerateScarb} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow transition">Generate Scarb</button>
            <TomlViewer toml={scarbToml} setToml={setScarbToml} />
            <button onClick={handleCompile} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl shadow transition">Compilar</button>
            <TerminalOutput output={output} />
        </div>
    )
}