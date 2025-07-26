import React, { useState, useEffect, useRef } from 'react'; // Removed useCallback
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// Helper to generate unique IDs
const generateUniqueId = () => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to create initial empty children for a new associate
const createEmptyChildren = (parentColor) => {
    const childColor = parentColor.replace('-300', '-200'); // Lighten color for children
    return [
        { id: generateUniqueId(), name: '', color: childColor, children: [] },
        { id: generateUniqueId(), name: '', color: childColor, children: [] },
        { id: generateUniqueId(), name: '', color: childColor, children: [] }
    ];
};

// Define the clean reset state (used when the user clicks Reset Names AND for initial blank load)
const getCleanResetOrgData = () => ({
    id: 'you',
    name: 'You',
    color: 'bg-white',
    children: [
        { id: generateUniqueId(), name: '', color: 'bg-yellow-300', children: [] },
        { id: generateUniqueId(), name: '', color: 'bg-cyan-300', children: [] },
        { id: generateUniqueId(), name: '', color: 'bg-fuchsia-300', children: [] }
    ]
});

// Set the initialOrgData to be the clean, blank state
const initialOrgData = getCleanResetOrgData();


// Node component for displaying and editing names
const Node = ({ node, onNameChange }) => {
    const nodeRef = useRef(null);

    const handleNameChange = (e) => {
        onNameChange(node.id, e.target.value);
    };

    const isEmpty = node.name.trim() === '';

    // Determine if the *current* node is qualified based on its *children*
    // If it has children, it's qualified if its own slot is filled AND all 3 children are filled.
    // If it has no children (lowest level), it's qualified if its own slot is filled.
    const isQualified = isEmpty ? false : // If slot is empty, not qualified
                    (node.children && node.children.length > 0) ? // If it's a parent node
                        (node.qualifiedChildrenCount === 3) : // It's qualified if its 3 children are filled
                        true; // It's a leaf node, qualified if its own slot is filled

    // Styling for node boxes, adjusted for responsiveness, ghosting, and qualification
    const nodeBoxClasses = `
        p-2 rounded-lg shadow-md border-2
        ${node.color}
        ${isEmpty ? 'border-dashed border-gray-400 bg-opacity-40' : 'border-solid'}
        ${isQualified ? 'border-green-500 ring-2 ring-green-400' : 'border-gray-400'}
        flex flex-col justify-center items-center text-center text-gray-800 font-semibold mb-2
        transform transition-all duration-300 ease-in-out
        ${isEmpty ? 'opacity-70 hover:opacity-100' : ''}
        // Responsive width and height to better fit various screen sizes
        w-[120px] h-[90px] sm:w-[130px] sm:h-[100px] md:w-[140px] md:h-[110px] lg:w-[150px] lg:h-[120px]
    `;

    const inputClasses = `
        mt-1 p-1 w-full text-center text-sm rounded bg-white
        ${isEmpty ? 'bg-opacity-80 placeholder-gray-500' : 'bg-opacity-70'}
        border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500
    `;

    const nodeLabel = node.id === 'you' ? node.name : (isEmpty ? 'Empty Slot' : 'Associate');
    const inputPlaceholder = isEmpty ? 'Add Name' : (node.id === 'you' ? 'Your Name' : 'Enter Name');

    return (
        <div ref={nodeRef} className="flex flex-col items-center flex-shrink-0" data-node-id={node.id}>
            {/* Node Box */}
            <div className={nodeBoxClasses}>
                <p className="text-xs sm:text-sm">
                    {nodeLabel}
                </p>
                <input
                    type="text"
                    value={node.name}
                    onChange={handleNameChange}
                    placeholder={inputPlaceholder}
                    className={inputClasses}
                />
                {/* Show "Qualified Recruits" for any node that is a parent (has children) */}
                {node.children && node.children.length > 0 && (
                    <div className="mt-2 text-sm text-gray-700 w-full">
                        <p className="font-bold">
                            Recruits: {node.qualifiedChildrenCount || 0}/3
                        </p>
                    </div>
                )}
            </div>
            {/* Render children if they exist */}
            {node.children && node.children.length > 0 && (
                <div className="flex justify-center w-full relative pt-8 px-2 sm:px-4 md:px-6 lg:px-8">
                    <div className="mt-8 flex justify-center flex-wrap">
                        {node.children.map((child) => (
                            <div
                                key={child.id}
                                className="flex flex-col items-center mx-3 sm:mx-5 md:mx-7 lg:mx-8 mb-4" // Added mb-4 for vertical spacing
                            >
                                <Node
                                    node={child}
                                    onNameChange={onNameChange}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Main App component
const App = () => {
    const [orgData, setOrgData] = useState(initialOrgData);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const treeVisualizerContainerRef = useRef(null);

    // Firebase configuration from your provided details
    const firebaseConfig = {
        apiKey: "AIzaSyAQTvYQLJ85ZiZArkZ4G9spiNsuKRdBWG8",
        authDomain: "manager-factory-6adf9.firebaseapp.com",
        projectId: "manager-factory-6adf9",
        storageBucket: "manager-factory-6adf9.firebasestorage.app",
        messagingSenderId: "599936305112",
        appId: "1:599936305112:web:6ec7e826ab0559411e94ad",
        measurementId: "G-BW8W53TDGZ"
    };

    // Initialize Firebase and Auth
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    // Use window.__app_id for Canvas environment, fallback for local dev
    const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';

    // Firebase Auth and Firestore Listener Setup
    useEffect(() => {
        const setupFirebase = async () => {
            try {
                // Try custom token first
                // Use window.__initial_auth_token for Canvas environment, fallback for local dev
                if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token !== null) {
                    try {
                        await signInWithCustomToken(auth, window.__initial_auth_token);
                    } catch (customTokenError) {
                        console.warn("Custom token sign-in failed, attempting anonymous sign-in:", customTokenError);
                        // If custom token sign-in fails, fall back to anonymous sign-in
                        await signInAnonymously(auth);
                    }
                } else {
                    // If no custom token is defined or it's null, sign in anonymously
                    await signInAnonymously(auth);
                }
            } catch (overallAuthError) {
                console.error("Firebase authentication error:", overallAuthError);
                setLoading(false); // Stop loading even if auth fails
            }
        };

        setupFirebase();

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const currentUserId = user.uid;
                setUserId(currentUserId);

                const userDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/managerTrees`, 'myTree');

                // Set up real-time listener for the user's tree data
                const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setOrgData(docSnap.data().treeData);
                    } else {
                        // If no data exists, set initial data and save it
                        // Use the clean, blank state for the very first load
                        setOrgData(getCleanResetOrgData());
                        setDoc(userDocRef, { treeData: getCleanResetOrgData() }).catch(e => console.error("Error setting initial doc:", e));
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Firestore snapshot error:", error);
                    setLoading(false);
                });

                return () => unsubscribeSnapshot(); // Clean up snapshot listener
            } else {
                setUserId(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth(); // Clean up auth listener
    }, [auth, db, appId]); // Dependencies for useEffect

    // Effect to save data to Firestore whenever orgData changes (after initial load)
    useEffect(() => {
        // Only save if userId is available and not in initial loading phase
        if (userId && !loading) {
            const saveOrgData = async () => {
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/managerTrees`, 'myTree');
                try {
                    await setDoc(userDocRef, { treeData: orgData });
                } catch (error) {
                    console.error("Failed to save data to Firestore:", error);
                }
            };
            // Debounce the save operation to prevent too many writes
            const handler = setTimeout(() => {
                saveOrgData();
            }, 500); // Save after 500ms of no changes
            return () => clearTimeout(handler);
        }
    }, [orgData, userId, loading, db, appId]);

    // Function to update a name in the organization data and add/remove children
    const updateNameInOrg = (nodeId, newName) => {
        const updateNode = (currentNode) => {
            if (currentNode.id === nodeId) {
                const updatedNode = { ...currentNode, name: newName };

                // Logic for dynamic children:
                // If name is added to a previously empty slot (and it's not the "You" node)
                if (newName.trim() !== '' && currentNode.name.trim() === '' && currentNode.id !== 'you') {
                    if (!updatedNode.children || updatedNode.children.length === 0) {
                        updatedNode.children = createEmptyChildren(updatedNode.color);
                    }
                } else if (newName.trim() === '' && currentNode.id !== 'you') {
                    // If name is cleared, remove children to revert to ghosted state
                    updatedNode.children = [];
                }
                return updatedNode;
            }
            if (currentNode.children) {
                return {
                    ...currentNode,
                    children: currentNode.children.map(updateNode)
                };
            }
            return currentNode;
        };
        setOrgData(updateNode(orgData));
    };

    // Recalculate 'qualifiedChildrenCount' for ALL parent nodes whenever orgData changes
    useEffect(() => {
        const calculateQualifiedRecruitsRecursively = (currentNode) => {
            if (currentNode.children && currentNode.children.length > 0) {
                let qualifiedCount = 0;
                currentNode.children.forEach(child => {
                    // Recursively calculate for children first
                    calculateQualifiedRecruitsRecursively(child);
                    // A direct child is "qualified" if their name slot is filled
                    if (child.name.trim() !== '') {
                        qualifiedCount++;
                    }
                });
                // Update the qualifiedChildrenCount for the current node
                if (currentNode.qualifiedChildrenCount !== qualifiedCount) {
                    currentNode.qualifiedChildrenCount = qualifiedCount;
                }
            } else {
                // Leaf nodes don't have qualifiedChildrenCount
                currentNode.qualifiedChildrenCount = 0;
            }
        };

        // Create a deep copy to modify and then set the state to trigger re-render
        // Only run this if orgData is not null (i.e., data has been loaded or initialized)
        if (orgData) {
            const updatedOrgData = JSON.parse(JSON.stringify(orgData));
            calculateQualifiedRecruitsRecursively(updatedOrgData);

            // Only update state if there's an actual change to avoid infinite loops
            // This comparison checks if the qualifiedChildrenCount property has changed anywhere in the tree
            if (JSON.stringify(updatedOrgData) !== JSON.stringify(orgData)) {
                setOrgData(updatedOrgData);
            }
        }
    }, [orgData]); // Dependency on orgData


    // Reset function
    const resetOrgData = () => {
        // Get the clean reset state with new IDs
        const newResetData = getCleanResetOrgData();
        setOrgData(newResetData);
        if (userId) {
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/managerTrees`, 'myTree');
            setDoc(userDocRef, { treeData: newResetData }).catch(e => console.error("Error resetting doc in Firestore:", e));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-gray-700 text-xl font-semibold">Loading your organization...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 font-sans relative">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-6 sm:mb-8 text-center px-4">
                Path to Manager Visualizer
            </h1>

            <div className="p-4 sm:p-6 bg-white rounded-xl shadow-lg border border-gray-200 mb-6 sm:mb-8 w-11/12 max-w-4xl text-center">
                <p className="text-md sm:text-lg text-gray-700 mb-3 sm:mb-4">
                    Visualize your path to Manager! Enter names into the boxes below to see how you and your team can grow.
                </p>
                <p className="text-sm sm:text-md text-gray-600">
                    To reach Manager, you need 3 frontline recruits. This diagram helps you map out who those individuals could be and how they, in turn, can build their teams.
                </p>
            </div>

            {userId && (
                <div className="mb-4 text-sm text-gray-600">
                    Your User ID: <span className="font-mono bg-gray-200 px-2 py-1 rounded">{userId}</span>
                </div>
            )}

            {/* This div is the scrollable container for the entire tree */}
            {/* The inner flex container needs to be centered for initial state, but allow scrolling when expanded */}
            <div ref={treeVisualizerContainerRef} className="tree-visualizer-container relative flex justify-center w-full overflow-x-auto overflow-y-auto pb-4 px-4 max-h-[calc(100vh-250px)]">
                {/* This inner div contains the actual tree nodes */}
                <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-inner border border-gray-200 relative z-20 flex-grow-0 flex-shrink-0">
                    <Node
                        node={orgData}
                        onNameChange={updateNameInOrg}
                    />
                </div>
            </div>

            <button
                onClick={resetOrgData}
                className="mt-8 px-6 py-3 bg-red-500 text-white font-bold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition duration-200 ease-in-out transform hover:scale-105"
            >
                Reset Names
            </button>

            <footer className="mt-12 px-4 text-gray-500 text-xs sm:text-sm text-center">
                <p>Your entered names are saved automatically in the cloud.</p>
                <p className="mt-1">This tool is for visualization purposes only and does not reflect real-time qualifications or bonuses.</p>
                <p>Please refer to official LegalShield documentation for full details on the Advance to Manager program.</p>
            </footer>
        </div>
    );
};

export default App;
