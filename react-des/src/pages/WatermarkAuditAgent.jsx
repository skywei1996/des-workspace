import React, { useState, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import ProjectSideMenu from '../components/ProjectSideMenu'
import axios from 'axios'
import { API_BASE } from '../config/api'

const contentReviewMenuItems = [
  { label: '水印审核', route: '/watermark-audit-agent' },
]

const WatermarkAuditAgent = () => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const imageRef = useRef(null)

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
    }
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return

    setLoading(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await axios.post(`${API_BASE}/watermark/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setResult(response.data)
    } catch (error) {
      console.error('Error analyzing image:', error)
      alert('Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Calculate box style based on image dimensions and bbox
  // bbox is [x1, y1, x2, y2]. Design doc specifies dividing by 999.
  const getBoxStyle = (bbox) => {
    if (!imageRef.current) return {}
    
    // We use percentage to be responsive
    const left = (bbox[0] / 999) * 100
    const top = (bbox[1] / 999) * 100
    const width = ((bbox[2] - bbox[0]) / 999) * 100
    const height = ((bbox[3] - bbox[1]) / 999) * 100

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
    }
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar compact />
      <ProjectSideMenu title="内容审核" subtitle="内容合规审核" items={contentReviewMenuItems} />
      <div className="flex-1 overflow-auto bg-[#F7F7F9] p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Image Watermark Audit Agent</h1>
              <p className="mt-1 text-sm text-gray-500">
                Automated watermark detection and audit system
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="space-y-6">
              {/* Upload Section */}
              <div className="flex items-center gap-4">
                <label className="block">
                  <span className="sr-only">Choose profile photo</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-[#6266EA]/10 file:text-[#6266EA]
                      hover:file:bg-[#6266EA]/20
                    "
                  />
                </label>
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedFile || loading}
                  className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                    !selectedFile || loading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#6266EA] hover:bg-[#5054D6]'
                  }`}
                >
                  {loading ? 'Analyzing...' : 'Analyze Watermarks'}
                </button>
              </div>

              {/* Main Content Area: Image + Results */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Image Preview & Overlay */}
                <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50 min-h-[400px] flex items-center justify-center p-4">
                  {previewUrl ? (
                    <div className="relative inline-block">
                      <img 
                        ref={imageRef}
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-[500px] block shadow-sm rounded"
                        onLoad={() => {
                            // Trigger re-render to ensure rects are calculated correctly if we used pixel values
                        }}
                      />
                      {result && result.recognized_texts && result.recognized_texts.map((item, index) => (
                        <div
                          key={index}
                          className={`absolute border-2 ${item.is_watermark ? 'border-red-500' : 'border-blue-500'} group`}
                          style={getBoxStyle(item.bbox)}
                        >
                          {/* Tooltip on hover */}
                          <div className="absolute top-full left-0 mt-1 bg-black/80 text-white text-xs px-2 py-1 rounded box-border z-10 whitespace-nowrap hidden group-hover:block pointer-events-none">
                            <p className="font-semibold">{item.is_watermark ? 'Watermark' : 'Text'}</p>
                            <p>Confidence: {item.confidence}</p>
                            <p className="italic max-w-[200px] truncate">{item.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center">
                      <p>Upload an image to start analysis</p>
                    </div>
                  )}
                </div>

                {/* Analysis Results Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
                  
                  {result ? (
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                        <p className="text-gray-600 text-sm">{result.image_description}</p>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Detections ({result.recognized_texts?.length || 0})</h4>
                        <div className="overflow-y-auto max-h-[400px] space-y-2 pr-2">
                          {result.recognized_texts?.map((item, index) => (
                            <div 
                              key={index}
                              className={`p-3 rounded-lg border ${
                                item.is_watermark 
                                  ? 'bg-red-50 border-red-100' 
                                  : 'bg-blue-50 border-blue-100'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  item.is_watermark ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {item.is_watermark ? 'Watermark' : 'Text'}
                                </span>
                                <span className="text-xs text-gray-500">Conf: {item.confidence}</span>
                              </div>
                              <p className="mt-2 text-sm font-medium text-gray-900 break-all">{item.text || '(No text content)'}</p>
                              {item.judgment_basis && (
                                <p className="mt-1 text-xs text-gray-500">{item.judgment_basis}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm italic">
                      Results will appear here after analysis.
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WatermarkAuditAgent
