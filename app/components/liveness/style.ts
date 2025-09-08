const styleDefinitions = `
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f0f0f0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        
        .container {
            text-align: center;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        
        #video-container {
            position: relative;
            display: inline-block;
            width: 400px;
            height: 400px;
            border-radius: 50%;
            overflow: hidden;
            background: #000;
        }
        
        #video {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
            transform: scaleX(-1);
        }
        
        .face-tracker-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
            border-radius: 50%;
            overflow: hidden;
        }
        
        .direction-circle {
            position: absolute;
            width: 80%;
            height: 80%;
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: transparent;
            border: 2px solid rgba(255, 255, 255, 0.4);
            transition: all 0.3s ease;
        }
        
        .direction-segment {
            position: absolute;
            background: transparent;
            transition: all 0.5s ease;
        }
        
        .segment-center {
            top: 35%;
            left: 35%;
            width: 30%;
            height: 30%;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.3);
            background: rgba(255, 255, 255, 0.1);
        }
        
        .segment-up {
            top: 10%;
            left: 10%;
            width: 80%;
            height: 80%;
            border: 4px solid transparent;
            border-top: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-bottom: none;
            border-left: none;
            border-right: none;
        }
        
        .segment-down {
            top: 10%;
            left: 10%;
            width: 80%;
            height: 80%;
            border: 4px solid transparent;
            border-bottom: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: none;
            border-left: none;
            border-right: none;
        }
        
        .segment-left {
            top: 10%;
            left: 10%;
            width: 80%;
            height: 80%;
            border: 4px solid transparent;
            border-left: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: none;
            border-bottom: none;
            border-right: none;
        }
        
        .segment-right {
            top: 10%;
            left: 10%;
            width: 80%;
            height: 80%;
            border: 4px solid transparent;
            border-right: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: none;
            border-bottom: none;
            border-left: none;
        }
        
        .segment-completed {
            border-color: #28a745 !important;
        }
        
        .segment-completed.segment-up {
            border-top-color: #28a745 !important;
        }
        
        .segment-completed.segment-down {
            border-bottom-color: #28a745 !important;
        }
        
        .segment-completed.segment-left {
            border-left-color: #28a745 !important;
        }
        
        .segment-completed.segment-right {
            border-right-color: #28a745 !important;
        }
        
        .segment-active {
            animation: pulseActive 1.5s infinite;
        }
        
        @keyframes pulseActive {
            0%, 100% { 
                transform: scale(1);
            }
            50% { 
                transform: scale(1.05);
            }
        }
        
        .face-outline {
            position: absolute;
            border: 3px solid rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            background: transparent;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
        }
        
        .face-outline.visible {
            opacity: 1;
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
        }
        
        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            background-color: #e7f3ff;
            font-weight: bold;
            font-size: 16px;
        }
        
        .progress-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 20px;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .progress-step {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px;
            border-radius: 8px;
            background-color: #f8f9fa;
            border: 2px solid #dee2e6;
            min-width: 70px;
            transition: all 0.3s ease;
        }
        
        .progress-step.active {
            color: white;
        }
        
        .progress-step.completed {
            background-color: #28a745;
            border-color: #28a745;
            color: white;
        }
        
        .step-icon {
            font-size: 18px;
            margin-bottom: 4px;
        }
        
        .step-text {
            font-size: 11px;
            font-weight: bold;
        }
        
        .progress-arrow {
            font-size: 16px;
            color: #6c757d;
            font-weight: bold;
        }
      `;

export default styleDefinitions;
