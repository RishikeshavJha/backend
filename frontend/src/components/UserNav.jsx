import { signOut } from '../firebase';
import { auth } from '../firebase';
import { LogIn, LogOut, User, Sparkles } from 'lucide-react';

export default function UserNav({ user, onOpenAuth }) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out failed:", err);
    }
  };

  if (!user) {
    return (
      <div className="user-nav">
        <button
          type="button"
          className="btn-signin-nav"
          onClick={onOpenAuth}
          aria-label="Sign in to your account"
        >
          <LogIn size={15} />
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  const displayName = user.displayName || user.email?.split('@')[0] || (user.isAnonymous ? 'Guest Citizen' : 'Citizen');
  const userInitials = (displayName || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="user-nav logged-in">
      <div className="user-profile-badge" title={user.email || 'Guest account'}>
        {user.photoURL ? (
          <img src={user.photoURL} alt={displayName} className="user-avatar-img" />
        ) : (
          <div className="user-avatar-fallback">
            {user.isAnonymous ? <Sparkles size={14} /> : userInitials}
          </div>
        )}
        <div className="user-info-text">
          <span className="user-name">{displayName}</span>
          <span className="user-role-tag">
            {user.isAnonymous ? 'Guest' : 'Authenticated'}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="btn-signout-nav"
        onClick={handleSignOut}
        title="Sign Out"
        aria-label="Sign out"
      >
        <LogOut size={15} />
        <span className="signout-label">Sign Out</span>
      </button>
    </div>
  );
}
