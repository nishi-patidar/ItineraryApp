import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Initialization of Firebase/Firestore ---
// Use environment variables for configuration
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app;
let db;
let auth;

try {
  if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    // Setting log level for debugging persistence
    // import { setLogLevel } from 'firebase/firestore';
    // setLogLevel('Debug');
    db = getFirestore(app);
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

// === Utility Functions ===

// Helper to convert date string (YYYY-MM-DD) to a more readable format
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) {
    return dateString;
  }
};

// Default itinerary structure for a new user/load failure
const defaultItinerary = {
  title: "Vigovia Trip Itinerary",
  destination: "Lisbon, Portugal",
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
  notes: "Remember to pack comfortable walking shoes and charge your camera battery!",
  itinerary: [
    {
      id: crypto.randomUUID(),
      day: 1,
      date: new Date().toISOString().split('T')[0],
      activities: [
        { id: crypto.randomUUID(), time: '09:00', description: 'Arrive at Airport' },
      ],
    },
  ],
  // New Budget Structure
  budget: {
    currency: 'USD',
    flights: { estimated: 600, actual: 0 },
    accommodation: { estimated: 500, actual: 0 },
    activities: { estimated: 400, actual: 0 },
    miscellaneous: { estimated: 100, actual: 0 },
  }
};

// --- Sub-Components for Pages ---

const NavBar = ({ currentPage, setCurrentPage, isAuthReady, userId }) => {
    const navItems = [
        { key: 'itinerary', label: 'Plan Itinerary' },
        { key: 'budget', label: 'Budget Planner' },
        { key: 'download', label: 'Download & Share' },
    ];
    
    // Status message for Auth/Sync
    const statusMessage = isAuthReady 
        ? (userId ? `User: ${userId.slice(0, 8)}...` : 'Using Local State')
        : 'Connecting...';

    return (
        <div className="flex justify-between items-center bg-gray-900 text-white shadow-xl z-20 sticky top-0 px-4 md:px-8">
            <div className="flex space-x-6">
                {navItems.map(item => (
                    <button
                        key={item.key}
                        onClick={() => setCurrentPage(item.key)}
                        className={`py-3 px-3 text-sm font-semibold transition-all duration-200 
                            ${currentPage === item.key 
                                ? 'border-b-4 border-emerald-400 text-emerald-400' 
                                : 'text-gray-300 hover:text-emerald-300 hover:border-b-4 hover:border-transparent'}`
                        }
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div className="text-xs font-mono py-2 text-gray-500 hidden sm:block">
                {statusMessage}
            </div>
        </div>
    );
};

const ItineraryInputForm = ({ tripDetails, handleDetailChange, handleActivityChange, addActivity, removeActivity, addDay, removeDay, generatePDF, isGenerating }) => (
  <div className="p-6 md:p-8 space-y-8 bg-white border-r border-emerald-100 h-full overflow-y-auto pt-4">
    <h2 className="text-3xl font-extrabold text-emerald-700 border-b pb-2">Plan Your Journey</h2>

    {/* General Details */}
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Trip Title</span>
        <input
          type="text"
          name="title"
          value={tripDetails.title}
          onChange={handleDetailChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Destination</span>
        <input
          type="text"
          name="destination"
          value={tripDetails.destination}
          onChange={handleDetailChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2"
        />
      </label>
      <div className="flex space-x-4">
        <label className="block flex-1">
          <span className="text-sm font-semibold text-gray-700">Start Date</span>
          <input
            type="date"
            name="startDate"
            value={tripDetails.startDate}
            onChange={handleDetailChange}
            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2"
          />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-semibold text-gray-700">End Date</span>
          <input
            type="date"
            name="endDate"
            value={tripDetails.endDate}
            onChange={handleDetailChange}
            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Trip Notes / Packing List</span>
        <textarea
          name="notes"
          value={tripDetails.notes}
          onChange={handleDetailChange}
          rows="3"
          placeholder="E.g., Book confirmation numbers, important contacts, packing list items..."
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2"
        />
      </label>
    </div>

    {/* Dynamic Itinerary Section */}
    <h3 className="text-xl font-bold text-gray-800 pt-4 border-t mt-8">Daily Activities</h3>
    <div className="space-y-6">
      {tripDetails.itinerary.map((day) => (
        <div key={day.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-md space-y-3">
          <div className="flex justify-between items-center border-b pb-2 mb-2">
            <h4 className="text-lg font-bold text-emerald-600">Day {day.day}</h4>
            <button
              onClick={() => removeDay(day.id)}
              className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors p-1 rounded-full"
              title={`Remove Day ${day.day}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {day.activities.map((activity, index) => (
            <div key={activity.id} className="flex space-x-2 items-start bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <input
                type="time"
                value={activity.time}
                onChange={(e) => handleActivityChange(day.id, activity.id, 'time', e.target.value)}
                className="w-28 p-1 rounded border-emerald-300 text-sm font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder={`Activity ${index + 1} Description`}
                value={activity.description}
                onChange={(e) => handleActivityChange(day.id, activity.id, 'description', e.target.value)}
                className="flex-1 p-1 rounded border-emerald-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                onClick={() => removeActivity(day.id, activity.id)}
                className="text-emerald-400 hover:text-red-500 transition-colors p-1 rounded-full"
                title="Remove Activity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={() => addActivity(day.id)}
            className="w-full text-sm py-2 mt-2 border border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
          >
            + Add Activity to Day {day.day}
          </button>
        </div>
      ))}
    </div>

    <button
      onClick={addDay}
      className="w-full text-lg py-3 mt-4 bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200 rounded-xl transition-colors shadow-md"
    >
      + Add New Day
    </button>
  </div>
);

const ItineraryPreview = ({ tripDetails }) => (
  <div className="flex-1 p-4 md:p-8 overflow-y-auto">
    <div
      id="itinerary-content"
      className="max-w-4xl mx-auto bg-white shadow-2xl p-6 md:p-12 space-y-10 border border-gray-200"
      style={{ minHeight: '297mm', width: '210mm', boxSizing: 'border-box' }} // A4 dimensions for PDF capture
    >
      {/* Header Section - Clean & Professional */}
      <header className="text-center py-8 bg-emerald-600 text-white rounded-t-lg shadow-lg">
        <h1 className="text-4xl font-extrabold uppercase tracking-widest border-b border-emerald-400 inline-block pb-2">
          {tripDetails.title || 'Untitled Trip Itinerary'}
        </h1>
        <p className="text-xl mt-3 font-light">
          {tripDetails.destination || 'Destination Unknown'}
        </p>
        <p className="text-sm opacity-80 mt-1">
          {formatDate(tripDetails.startDate)} &mdash; {formatDate(tripDetails.endDate)}
        </p>
      </header>

      {/* Itinerary Body - Timeline Style */}
      <section className="space-y-10 relative mt-12">
        
        {/* Vertical Timeline Line */}
        <div className="absolute left-[30px] md:left-[110px] top-0 bottom-0 w-1 bg-gray-200 hidden md:block"></div>

        {tripDetails.itinerary.map((day) => (
          <div key={day.id} className="relative flex flex-col md:flex-row md:space-x-12">

            {/* Day Marker (Left/Timeline) */}
            <div className="md:w-32 flex-shrink-0 flex items-center mb-4 md:mb-0">
              {/* Timeline Dot (Orange Accent) */}
              <div className="absolute left-[26px] md:left-[106px] w-4 h-4 bg-orange-500 rounded-full z-10 hidden md:block border-2 border-white"></div>
              
              <div className="bg-orange-500 text-white px-4 py-2 rounded-full font-extrabold text-lg shadow-lg w-full md:w-auto text-center md:text-right">
                  Day {day.day}
              </div>
            </div>

            {/* Activities Content (Right) */}
            <div className="flex-1 border-t border-gray-100 pt-4 md:pt-0">
              
              {/* Date Header */}
              <div className="mb-4 -mt-2">
                  <h2 className="text-xl font-semibold text-gray-800">
                      {formatDate(day.date)}
                  </h2>
              </div>

              {/* Activities List */}
              <ul className="space-y-4">
                {day.activities.map((activity) => (
                  <li key={activity.id} className="flex space-x-4 items-start pb-2 border-b border-dashed border-gray-100">
                    {/* Time Slot (Emerald Primary) */}
                    <div className="w-20 flex-shrink-0 text-lg font-extrabold text-emerald-600">
                      {activity.time || 'TBD'}
                    </div>
                    
                    {/* Description */}
                    <div className="flex-1 text-base text-gray-700">
                      {activity.description || 'No Activity Planned'}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* Trip Notes Section */}
      <section className="mt-12 pt-8 border-t-2 border-emerald-100">
          <h2 className="text-2xl font-extrabold text-emerald-700 mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Trip Notes & Reminders
          </h2>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 whitespace-pre-wrap">
              {tripDetails.notes || 'No notes added for this trip.'}
          </div>
      </section>

      {/* Budget Summary Section (New) */}
      <section className="mt-12 pt-8 border-t-2 border-emerald-100">
        <h2 className="text-2xl font-extrabold text-emerald-700 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Budget Summary
        </h2>
        <div className="grid grid-cols-2 gap-4 text-gray-700 font-semibold">
            <div className='text-lg font-bold'>Category</div>
            <div className='text-lg font-bold text-right'>Estimated / Actual</div>
            {Object.entries(tripDetails.budget).filter(([key]) => key !== 'currency').map(([key, value]) => (
                <React.Fragment key={key}>
                    <div className="capitalize">{key}</div>
                    <div className="text-right font-mono text-sm">
                        <span className="text-emerald-600 mr-2">Est: {tripDetails.budget.currency}{value.estimated.toLocaleString()}</span>
                        /
                        <span className="text-red-500 ml-2">Act: {tripDetails.budget.currency}{value.actual.toLocaleString()}</span>
                    </div>
                </React.Fragment>
            ))}
        </div>
      </section>


      {/* Footer Section */}
      <footer className="text-center pt-10 border-t border-gray-200 mt-12">
        <p className="text-xs text-gray-400">
          Powered by Vigovia Itinerary Planner | Document Reference: #{crypto.randomUUID().slice(0, 8)}
        </p>
        <p className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} All Rights Reserved.
        </p>
      </footer>
    </div>
  </div>
);

const BudgetPlanner = ({ budget, currency, handleBudgetChange }) => {
    // Calculate totals
    const totalEstimated = Object.values(budget).reduce((sum, item) => 
        (typeof item.estimated === 'number' ? sum + item.estimated : sum), 0);
    const totalActual = Object.values(budget).reduce((sum, item) => 
        (typeof item.actual === 'number' ? sum + item.actual : sum), 0);
    
    // Determine status and color
    const status = totalActual > totalEstimated ? 'Over Budget' : 'On Track';
    const statusColor = totalActual > totalEstimated ? 'text-red-600 bg-red-50 border-red-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
    const difference = totalActual - totalEstimated;


    const budgetCategories = useMemo(() => ([
        { key: 'flights', label: 'Flights' },
        { key: 'accommodation', label: 'Accommodation' },
        { key: 'activities', label: 'Activities & Sightseeing' },
        { key: 'miscellaneous', label: 'Miscellaneous/Buffer' },
    ]), []);

    const currencyOptions = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];

    return (
        <div className="p-6 md:p-8 space-y-8 bg-white border-r border-emerald-100 h-full overflow-y-auto pt-4">
            <h2 className="text-3xl font-extrabold text-emerald-700 border-b pb-2">Trip Budget Planner</h2>

            {/* Currency Selector */}
            <label className="block max-w-xs">
                <span className="text-sm font-semibold text-gray-700">Select Currency</span>
                <select
                    name="currency"
                    value={currency}
                    onChange={handleBudgetChange}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2"
                >
                    {currencyOptions.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </label>

            {/* Budget Input Grid */}
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4 font-bold text-gray-700 border-b pb-2">
                    <div>Category</div>
                    <div className="text-right">Estimated ({currency})</div>
                    <div className="text-right">Actual ({currency})</div>
                </div>

                {budgetCategories.map(({ key, label }) => (
                    <div key={key} className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 rounded-lg shadow-sm">
                        <div className="font-medium text-gray-800">{label}</div>
                        <input
                            type="number"
                            name={key}
                            data-field="estimated"
                            value={budget[key]?.estimated || 0}
                            onChange={handleBudgetChange}
                            min="0"
                            placeholder="0"
                            className="text-right rounded-lg border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 p-2"
                        />
                        <input
                            type="number"
                            name={key}
                            data-field="actual"
                            value={budget[key]?.actual || 0}
                            onChange={handleBudgetChange}
                            min="0"
                            placeholder="0"
                            className="text-right rounded-lg border-gray-300 focus:ring-red-500 focus:border-red-500 p-2"
                        />
                    </div>
                ))}
            </div>

            {/* Totals Summary */}
            <div className="pt-6 border-t-2 border-emerald-200 space-y-3">
                <h3 className="text-xl font-bold text-gray-800">Budget Totals</h3>

                <div className="flex justify-between p-3 border-b">
                    <span className="font-semibold text-gray-600">Total Estimated Cost:</span>
                    <span className="font-extrabold text-emerald-600 text-xl">{currency}{totalEstimated.toLocaleString()}</span>
                </div>

                <div className="flex justify-between p-3 border-b">
                    <span className="font-semibold text-gray-600">Total Actual Spending:</span>
                    <span className="font-extrabold text-red-600 text-xl">{currency}{totalActual.toLocaleString()}</span>
                </div>

                <div className={`p-4 rounded-xl text-center font-extrabold text-2xl border-4 ${statusColor}`}>
                    {status}: {currency}{Math.abs(difference).toLocaleString()} {difference > 0 ? 'Over' : 'Remaining'}
                </div>
            </div>
        </div>
    );
};

const DownloadHelp = ({ generatePDF, isGenerating }) => (
    <div className="p-6 md:p-8 space-y-8 bg-white border-r border-emerald-100 h-full overflow-y-auto pt-4">
        <h2 className="text-3xl font-extrabold text-emerald-700 border-b pb-2">Download & Sharing Guide</h2>

        <div className="space-y-6">
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 shadow-md">
                <h3 className="text-xl font-bold text-emerald-700 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Step 1: Generate PDF
                </h3>
                <p className="text-gray-700 mb-4">
                    All data from your **Itinerary** and **Budget Planner** pages are combined into a professional PDF document. Click the button below to start the generation process.
                </p>
                <button
                    onClick={generatePDF}
                    disabled={isGenerating}
                    className="w-full py-3 text-lg font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                    {isGenerating ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Preparing Document...</span>
                        </>
                    ) : (
                        <span>Generate & Download Itinerary PDF</span>
                    )}
                </button>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-md">
                <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Step 2: Sharing
                </h3>
                <p className="text-gray-700">
                    Once the PDF is downloaded to your device, you can easily share it with travel companions, print copies, or upload it to cloud storage.
                </p>
                <div className="mt-4 p-3 bg-gray-100 rounded-md text-sm text-gray-600">
                    <span className="font-semibold">Note:</span> Your data is **automatically saved** in real-time. If you share this web link, others will see the latest version if they are authenticated with your account's access token.
                </div>
            </div>
    </div>
  </div>
);


// --- Main App Component ---

const App = () => {
  const [currentPage, setCurrentPage] = useState('itinerary'); // 'itinerary', 'budget', 'download'
  const [tripDetails, setTripDetails] = useState(defaultItinerary);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);

  // 1. DYNAMIC SCRIPT LOADING (for PDF)
  useEffect(() => {
    const loadScript = (url) => {
      if (document.querySelector(`script[src="${url}"]`)) return;
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    };

    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  }, []);

  // 2. FIREBASE AUTHENTICATION & SETUP
  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return;
    }

    const signIn = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Sign-in Failed:", error);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
      setIsAuthReady(true);
    });

    signIn();

    return () => unsubscribe();
  }, []);

  // 4. FIRESTORE SAVE FUNCTION
  const saveItinerary = useCallback(async (dataToSave) => {
    if (!db || !userId) {
      // console.warn("Firestore not available or user not authenticated. Cannot save.");
      return;
    }

    const docPath = `artifacts/${appId}/users/${userId}/itinerary_data/trip_master`;
    const docRef = doc(db, docPath);

    try {
        await setDoc(docRef, {
            // Serialize state to JSON string for safe storage in Firestore
            itineraryData: JSON.stringify(dataToSave),
            lastUpdated: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error saving document:", error);
    }
  }, [db, userId, appId]);


  // 3. FIRESTORE DATA LISTENER
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;

    const docPath = `artifacts/${appId}/users/${userId}/itinerary_data/trip_master`;
    const docRef = doc(db, docPath);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.itineraryData) {
            try {
                const parsedData = JSON.parse(data.itineraryData);
                setTripDetails(parsedData);
            } catch (e) {
                console.error("Error parsing stored itinerary data:", e);
                setTripDetails(defaultItinerary);
            }
        } else {
            // Document exists but is empty, initialize with default data
            saveItinerary(defaultItinerary);
        }
      } else {
        // Document does not exist, create it with default data
        saveItinerary(defaultItinerary);
      }
    }, (error) => {
      console.error("Firestore Listener Error:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, userId, db, saveItinerary]);

  // --- HANDLERS ---

  // Update trip details (title, dates, notes) and trigger save
  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    
    setTripDetails(prev => {
        let newState = { ...prev, [name]: value };

        // Synchronize itinerary dates when startDate changes
        if (name === 'startDate' && prev.itinerary.length > 0) {
            const startDateObj = new Date(value);
            newState.itinerary = prev.itinerary.map((day) => {
                const newDateObj = new Date(startDateObj.getTime() + (day.day - 1) * 86400000);
                const newDate = newDateObj.toISOString().split('T')[0];
                return { ...day, date: newDate };
            });
        }
        
        saveItinerary(newState);
        return newState;
    });
  };

  // Update activity details and trigger save
  const handleActivityChange = (dayId, activityId, field, value) => {
    setTripDetails(prev => {
        const newItinerary = prev.itinerary.map((day) => {
            if (day.id === dayId) {
                return {
                    ...day,
                    activities: day.activities.map((activity) =>
                        activity.id === activityId ? { ...activity, [field]: value } : activity
                    ),
                };
            }
            return day;
        });
        const newState = { ...prev, itinerary: newItinerary };
        saveItinerary(newState);
        return newState;
    });
  };

  // Add/Remove Activity/Day (functions remain the same but use the updated setTripDetails logic)
  const addActivity = (dayId) => {
    setTripDetails(prev => {
        const newItinerary = prev.itinerary.map((day) => {
            if (day.id === dayId) {
                return {
                    ...day,
                    activities: [...day.activities, { id: crypto.randomUUID(), time: '', description: '' }],
                };
            }
            return day;
        });
        const newState = { ...prev, itinerary: newItinerary };
        saveItinerary(newState);
        return newState;
    });
  };

  const removeActivity = (dayId, activityId) => {
    setTripDetails(prev => {
        const newItinerary = prev.itinerary.map((day) => {
            if (day.id === dayId) {
                return {
                    ...day,
                    activities: day.activities.filter((activity) => activity.id !== activityId),
                };
            }
            return day;
        });
        const newState = { ...prev, itinerary: newItinerary };
        saveItinerary(newState);
        return newState;
    });
  };
  
  const addDay = () => {
    setTripDetails(prev => {
        const newDayNumber = prev.itinerary.length + 1;
        const startDate = new Date(prev.startDate);
        const newDate = new Date(startDate.getTime() + (newDayNumber - 1) * 86400000).toISOString().split('T')[0];

        const newDay = {
            id: crypto.randomUUID(),
            day: newDayNumber,
            date: newDate,
            activities: [{ id: crypto.randomUUID(), time: '09:00', description: 'New Day Activity' }],
        };
        const newState = { ...prev, itinerary: [...prev.itinerary, newDay] };
        saveItinerary(newState);
        return newState;
    });
  };

  const removeDay = (dayId) => {
    setTripDetails(prev => {
        let dayIndex = 1;
        const filteredItinerary = prev.itinerary.filter((day) => day.id !== dayId);
        
        const newItinerary = filteredItinerary.map((day) => {
            const startDate = new Date(prev.startDate);
            const newDate = new Date(startDate.getTime() + (dayIndex - 1) * 86400000).toISOString().split('T')[0];
            
            return {
                ...day,
                day: dayIndex++,
                date: newDate,
            }
        });
        const newState = { ...prev, itinerary: newItinerary };
        saveItinerary(newState);
        return newState;
    });
  };

  // NEW: Budget change handler
  const handleBudgetChange = (e) => {
    const { name, value, dataset } = e.target;

    setTripDetails(prev => {
        let newState;
        if (name === 'currency') {
            // Update currency globally
            newState = { ...prev, budget: { ...prev.budget, currency: value } };
        } else if (dataset.field) {
            // Update estimated or actual cost for a category
            const numericValue = parseFloat(value) || 0;
            newState = {
                ...prev,
                budget: {
                    ...prev.budget,
                    [name]: {
                        ...prev.budget[name],
                        [dataset.field]: numericValue,
                    },
                },
            };
        } else {
            newState = prev;
        }

        saveItinerary(newState);
        return newState;
    });
  };

  // PDF Generation Logic (Unchanged for stability)
  const generatePDF = useCallback(async () => {
    // Before generating, ensure the latest state is saved
    await saveItinerary(tripDetails);

    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
      console.error("PDF libraries (jsPDF or html2canvas) not loaded.");
      setIsGenerating(false);
      console.log('PDF libraries not loaded. Please ensure internet connection or try again.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;

    // We capture the preview element, which contains all itinerary data including the budget summary
    const input = document.getElementById('itinerary-content'); 
    if (!input) {
      console.error('Itinerary content element not found.');
      setIsGenerating(false);
      return;
    }

    try {
      const scale = 2;
      const canvas = await html2canvas(input, {
        scale: scale,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgHeight = (canvas.height * pdfWidth) / canvas.width / scale;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 1) { // Changed to > 1 to avoid tiny residual pages
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${tripDetails.title.replace(/\s/g, '_')}_Itinerary.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      console.log('Could not generate PDF. Check console for details.');
    } finally {
      setIsGenerating(false);
    }
  }, [tripDetails, saveItinerary]);
  
  // --- RENDERING LOGIC ---

  const renderCurrentEditor = () => {
    switch (currentPage) {
        case 'budget':
            return <BudgetPlanner 
                budget={tripDetails.budget} 
                currency={tripDetails.budget.currency} 
                handleBudgetChange={handleBudgetChange} 
            />;
        case 'download':
            return <DownloadHelp 
                generatePDF={generatePDF} 
                isGenerating={isGenerating} 
            />;
        case 'itinerary':
        default:
            return <ItineraryInputForm 
                tripDetails={tripDetails} 
                handleDetailChange={handleDetailChange}
                handleActivityChange={handleActivityChange}
                addActivity={addActivity}
                removeActivity={removeActivity}
                addDay={addDay}
                removeDay={removeDay}
                generatePDF={generatePDF} // Keep here for quick access
                isGenerating={isGenerating} // Keep here for quick access
            />;
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased flex flex-col">
        
      {/* 1. Navigation Bar (Fixed at the top) */}
      <NavBar 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
          isAuthReady={isAuthReady} 
          userId={userId} 
      />

      {/* 2. Main Content Area */}
      <div className="flex flex-1 flex-col lg:flex-row">
        
        {/* Editor Column (Left) */}
        <div className="w-full lg:w-1/3 min-h-[50vh] lg:min-h-screen lg:max-h-screen relative shadow-2xl z-10 bg-gray-100">
          {renderCurrentEditor()}
        </div>

        {/* Preview Column (Right) */}
        <div className="flex-1 lg:w-2/3 min-h-screen py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 border-b pb-2">Itinerary Preview (Includes Budget Summary)</h2>
            <ItineraryPreview tripDetails={tripDetails} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
