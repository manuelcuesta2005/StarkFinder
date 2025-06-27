/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { CairoContractGenerator } from "@/lib/devxstark/contract-generator1";
import { DojoContractGenerator } from "@/lib/devxstark/dojo-contract-generator";
import { scarbGenerator } from "@/lib/devxstark/scarb-generator";
import prisma from "@/lib/db";
import { getOrCreateUser } from "@/app/api/transactions/helper";
import path from "path";
import { promises as fs } from "fs";

// Helper function to save both source and Scarb files
async function saveContractWithScarb(
  sourceCode: string,
  contractName: string = "lib"
): Promise<{ sourcePath: string; scarbPath: string }> {
  const contractsDir = path.join(process.cwd(), "..", "contracts");
  const srcDir = path.join(contractsDir, "src");

  try {
    // Ensure directories exist
    await fs.mkdir(srcDir, { recursive: true });

    // Save the Cairo source code
    const sourceFilePath = path.join(srcDir, `${contractName}.cairo`);
    await fs.writeFile(sourceFilePath, sourceCode, { encoding: 'utf8', flag: 'w' });

    // Generate and save Scarb.toml
    const scarbToml = await scarbGenerator.generateScarbToml(sourceCode, contractName);
    const scarbFilePath = path.join(contractsDir, "Scarb.toml");
    await fs.writeFile(scarbFilePath, scarbToml, { encoding: 'utf8', flag: 'w' });

    // Verify files were written correctly
    const writtenSource = await fs.readFile(sourceFilePath, 'utf8');
    const writtenScarb = await fs.readFile(scarbFilePath, 'utf8');
    
    if (writtenSource !== sourceCode) {
      throw new Error('Source file content verification failed');
    }

    return {
      sourcePath: sourceFilePath,
      scarbPath: scarbFilePath
    };
  } catch (error) {
    console.error("Error saving contract files:", error);
    throw new Error(
      `Failed to save contract files: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const signal = controller.signal;

  // Set a timeout for the request
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const { nodes, edges, flowSummary, userId, blockchain } = await req.json();
    
    // Validate input
    if (
      !Array.isArray(nodes) ||
      !Array.isArray(edges) ||
      !Array.isArray(flowSummary)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid input format. Expected arrays for nodes and edges, and string for flowSummary.",
          received: {
            nodes: typeof nodes,
            edges: typeof edges,
            flowSummary: typeof flowSummary,
          },
        },
        { status: 400 }
      );
    }

    const flowSummaryJSON = {
      nodes,
      edges,
      summary: flowSummary,
    };

    // Create a more robust body string with proper error handling
    const bodyOfTheCall = Object.entries(flowSummaryJSON)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.join(", ")}]`;
        }
        return `${key}: ${value}`;
      })
      .join(", ");

    const generators = {
      blockchain1: new CairoContractGenerator(),
      blockchain4: new DojoContractGenerator(),
    };
    const generator = generators[blockchain as "blockchain1" | "blockchain4"];

    // Create a response object that supports streaming
    const response = new NextResponse(
      new ReadableStream({
        async start(controller) {
          let accumulatedContent = "";
          let finalSourceCode = "";
          let scarbToml = "";

          // Helper function to extract code from content
          const extractCodeFromContent = (content: string): string => {
            // Look for ALL Cairo/Rust code blocks
            const cairoCodeBlockRegex = /```(?:cairo|rust)?\s*([\s\S]*?)```/g;
            const matches = [...content.matchAll(cairoCodeBlockRegex)];
            
            if (matches && matches.length > 0) {
              // Get the LAST code block (most recent/final)
              const lastMatch = matches[matches.length - 1];
              const code = lastMatch[1]?.trim() || '';
              
              // Ensure it contains a proper Cairo contract
              if (code.includes('mod contract') || code.includes('#[starknet::contract]')) {
                return code;
              }
            }
            
            // If no proper code blocks found, look for mod contract pattern directly
            const modContractRegex = /mod contract\s*\{[\s\S]*?\n\}/g;
            const contractMatches = [...content.matchAll(modContractRegex)];
            
            if (contractMatches && contractMatches.length > 0) {
              return contractMatches[contractMatches.length - 1][0].trim();
            }
            
            return '';
          };

          try {
            // Generate the contract - accumulate content silently
            const result = await generator.generateContract(bodyOfTheCall, {
              onProgress: (chunk) => {
                accumulatedContent += chunk;
              },
            });

            if (!result.success || !result.sourceCode) {
              throw new Error(result.error || "Failed to generate source code.");
            }

            // Extract final clean code
            let finalCode = result.sourceCode;
            
            // If the result doesn't look like proper code, try extracting from accumulated content
            if (!finalCode.includes('mod contract') && !finalCode.includes('#[starknet::contract]')) {
              const extractedFinalCode = extractCodeFromContent(accumulatedContent);
              if (extractedFinalCode) {
                finalCode = extractedFinalCode;
              }
            }

            if (!finalCode || finalCode.length < 50) {
              throw new Error("Generated code is empty or too short");
            }

            finalSourceCode = finalCode;

            // Generate Scarb.toml for the contract
            try {
              scarbToml = await scarbGenerator.generateScarbToml(finalCode, "lib");
              console.log("Generated Scarb.toml successfully");
            } catch (scarbError) {
              console.error("Error generating Scarb.toml:", scarbError);
              // Use a basic fallback if generation fails
              scarbToml = `[package]
name = "generated_contract"
version = "0.1.0"
edition = "2024_07"
cairo_version = "2.8.0"

[dependencies]
starknet = "2.8.0"

[[target.starknet-contract]]
sierra = true
casm = true

[cairo]
sierra-replace-ids = true`;
            }

            const { sourcePath, scarbPath } = await saveContractWithScarb(finalCode, "lib");
            console.log(`Contract saved to: ${sourcePath}`);
            console.log(`Scarb.toml saved to: ${scarbPath}`);
            
            // Save to database
            await getOrCreateUser(userId);
            await prisma.generatedContract.create({
              data: {
                name: "Generated Contract",
                sourceCode: finalCode,
                scarbConfig: scarbToml,
                userId,
              },
            });

            // Create a response object that includes both source code and Scarb.toml
            const responseData = {
              sourceCode: finalCode,
              scarbToml: scarbToml,
              success: true
            };

            // Send the response as JSON
            controller.enqueue(new TextEncoder().encode(JSON.stringify(responseData)));

          } catch (error) {
            console.error('Generation error:', error);
            const errorResponse = {
              success: false,
              error: error instanceof Error ? error.message : "An unexpected error occurred"
            };
            controller.enqueue(new TextEncoder().encode(JSON.stringify(errorResponse)));
          } finally {
            controller.close();
            clearTimeout(timeoutId);
          }
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}