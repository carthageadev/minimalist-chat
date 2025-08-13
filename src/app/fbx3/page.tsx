"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import the 3D viewer to avoid SSR issues
const CharacterViewer = dynamic(() => import("~/components/CharacterViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      Loading 3D viewer...
    </div>
  ),
});

// Available 3D models - save your .fbx files in the public/models/ directory
const AVAILABLE_MODELS = [
  {
    id: "none",
    name: "Select a model",
    path: "",
  },
  {
    id: "x-bot",
    name: "X Bot",
    path: "/models/x-bot.fbx",
  },
];

// Available animations - save your .fbx files in the public/animations/ directory
const AVAILABLE_ANIMATIONS = [
  {
    id: "none",
    name: "No animation",
    path: "",
  },
  {
    id: "waving",
    name: "Waving Animation",
    path: "/animations/waving.fbx",
  },
  {
    id: "walking",
    name: "Walking Animation",
    path: "/animations/walking.fbx",
  },
];

export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedAnimation, setSelectedAnimation] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleModelSelect = (modelPath: string) => {
    setSelectedModel(modelPath);
    setIsLoading(true);
  };

  const handleAnimationSelect = (animationPath: string) => {
    setSelectedAnimation(animationPath);
  };

  const clearModel = () => {
    setSelectedModel("");
    setSelectedAnimation("");
    setIsLoading(false);
  };

  const selectedModelData = AVAILABLE_MODELS.find(
    (model) => model.path === selectedModel
  );
  const selectedAnimationData = AVAILABLE_ANIMATIONS.find(
    (animation) => animation.path === selectedAnimation
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            3D Character Viewer
          </h1>
          <p className="text-gray-300 text-lg">
            Select a 3D character model and animation to view it in 3D
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Model Selection Section */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Select Character & Animation
              </h2>

              {/* Model Dropdown */}
              <div className="mb-6">
                <label className="block text-white text-sm font-medium mb-2">
                  Choose a 3D Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.id} value={model.path}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Animation Dropdown */}
              <div className="mb-6">
                <label className="block text-white text-sm font-medium mb-2">
                  Choose an Animation
                </label>
                <select
                  value={selectedAnimation}
                  onChange={(e) => handleAnimationSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {AVAILABLE_ANIMATIONS.map((animation) => (
                    <option key={animation.id} value={animation.path}>
                      {animation.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Model Info */}
              {selectedModelData && selectedModelData.id !== "none" && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-300 font-medium">
                        {selectedModelData.name}
                      </p>
                      <p className="text-green-400 text-sm">
                        {selectedModelData.path}
                      </p>
                    </div>
                    <button
                      onClick={clearModel}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Animation Info */}
              {selectedAnimationData && selectedAnimationData.id !== "none" && (
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <div>
                    <p className="text-blue-300 font-medium">
                      {selectedAnimationData.name}
                    </p>
                    <p className="text-blue-400 text-sm">
                      {selectedAnimationData.path}
                    </p>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-blue-300 font-medium mb-2">Instructions</h3>
                <ul className="text-blue-400 text-sm space-y-1">
                  <li>• Select a 3D model from the dropdown</li>
                  <li>• Choose an animation to apply</li>
                  <li>• Use mouse to rotate the view</li>
                  <li>• Scroll to zoom in/out</li>
                  <li>• Right-click and drag to pan</li>
                </ul>
              </div>

              {/* File Location Info */}
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <h3 className="text-yellow-300 font-medium mb-2">
                  Adding Models & Animations
                </h3>
                <p className="text-yellow-400 text-sm">
                  To add your own models, save .fbx files in the{" "}
                  <code className="bg-black/20 px-1 rounded">
                    public/animations/
                  </code>{" "}
                  directory.
                </p>
                <p className="text-yellow-400 text-sm mt-2">
                  To add animations, save .fbx files in the{" "}
                  <code className="bg-black/20 px-1 rounded">
                    public/animations/
                  </code>{" "}
                  directory.
                </p>
                <p className="text-yellow-400 text-sm mt-2">
                  Update the AVAILABLE_MODELS and AVAILABLE_ANIMATIONS arrays in
                  the code.
                </p>
              </div>
            </div>
          </div>

          {/* 3D Viewer Section */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-4">
                3D Preview
              </h2>

              <div className="relative h-96 lg:h-[500px] rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
                {selectedModel ? (
                  <CharacterViewer
                    modelPath={selectedModel}
                    animationPath={selectedAnimation || undefined}
                    onLoadComplete={() => setIsLoading(false)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <svg
                        className="mx-auto h-16 w-16 mb-4 opacity-50"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                        />
                      </svg>
                      <p className="text-lg">
                        Select a model from the dropdown to view
                      </p>
                    </div>
                  </div>
                )}

                {isLoading && selectedModel && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                      <p>Loading 3D model...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}