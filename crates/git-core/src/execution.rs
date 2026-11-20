use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

#[derive(Clone, Default)]
pub struct Cancellation(Arc<AtomicBool>);

impl Cancellation {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Relaxed);
    }

    pub(crate) fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}

pub struct Execution<'a> {
    pub(crate) emit: &'a (dyn Fn(String) + Sync),
    pub(crate) cancellation: Option<&'a Cancellation>,
}

impl<'a> Execution<'a> {
    pub fn new(emit: &'a (dyn Fn(String) + Sync)) -> Self {
        Self {
            emit,
            cancellation: None,
        }
    }

    pub fn cancellable(emit: &'a (dyn Fn(String) + Sync), cancellation: &'a Cancellation) -> Self {
        Self {
            emit,
            cancellation: Some(cancellation),
        }
    }
}
