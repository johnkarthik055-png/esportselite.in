import { useState, useEffect } from 'react'
import {
  doc, onSnapshot, collection,
} from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Live-listen to a team document + its member subcollection.
 * Returns team, members[], and the current user's role in the team.
 */
export function useTeam(teamId) {
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [myRole, setMyRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!teamId) {
      setTeam(null)
      setMembers([])
      setMyRole(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const teamUnsub = onSnapshot(
      doc(db, 'teams', teamId),
      (snap) => {
        if (snap.exists()) setTeam({ id: snap.id, ...snap.data() })
        else setTeam(null)
      },
      (err) => setError(err.message)
    )

    const membersUnsub = onSnapshot(
      collection(db, 'teams', teamId, 'members'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .sort((a, b) => {
            const at = a.joinDate?.toMillis?.() || 0
            const bt = b.joinDate?.toMillis?.() || 0
            return at - bt
          })
        setMembers(list)
        const me = list.find((m) => m.uid === user?.uid)
        setMyRole(me?.role ?? null)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )

    return () => {
      teamUnsub()
      membersUnsub()
    }
  }, [teamId, user?.uid])

  return { team, members, myRole, loading, error }
}

/**
 * Live-listen to users/{uid}.teamId so the UI reacts immediately when
 * the current user creates, joins, or leaves a team.
 */
export function useUserTeamId() {
  const { user, loading: authLoading } = useAuth()
  const [teamId, setTeamId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.uid) {
      setTeamId(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setTeamId(snap.exists() ? snap.data()?.teamId ?? null : null)
        setLoading(false)
      },
      () => {
        setTeamId(null)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [user?.uid, authLoading])

  return { teamId, loading }
}
